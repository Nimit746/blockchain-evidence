/**
 * Audit Logger Middleware
 * 
 * Express middleware for automatically logging evidence-related actions.
 * Provides non-blocking audit logging for all evidence endpoints.
 * 
 * @module middlewares/auditLogger.middleware
 * @author blockchain-evidence team
 * @issue #32 - Add centralized audit logging for evidence-related actions
 */

const auditLogger = require('../services/auditLogger.service');

/**
 * Extract client IP address from request
 * Handles proxy headers for accurate IP tracking
 * 
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown';
};

/**
 * Extract user information from request
 * 
 * @param {Object} req - Express request object
 * @returns {Object} User info { userId, userRole }
 */
const getUserInfo = (req) => {
    // Check if user is attached by authentication middleware
    if (req.user) {
        return {
            userId: req.user.wallet_address || req.user.id,
            userRole: req.user.role || 'user'
        };
    }

    // Fallback to header-based identification
    const walletAddress = req.headers['x-user-wallet'];
    return {
        userId: walletAddress || 'anonymous',
        userRole: req.userRole || 'unknown'
    };
};

/**
 * Map HTTP method and path to action type
 * 
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {string} Action type
 */
const getActionType = (method, path) => {
    const methodLower = method.toLowerCase();

    // Check for specific evidence actions in path
    if (path.includes('/verify')) {
        return auditLogger.ACTION_TYPES.VERIFY;
    }

    if (path.includes('/download')) {
        return auditLogger.ACTION_TYPES.DOWNLOAD;
    }

    if (path.includes('/transfer')) {
        return auditLogger.ACTION_TYPES.TRANSFER;
    }

    if (path.includes('/custody')) {
        return auditLogger.ACTION_TYPES.CHAIN_OF_CUSTODY;
    }

    // Map HTTP methods to default actions
    switch (methodLower) {
        case 'post':
            return auditLogger.ACTION_TYPES.CREATE;
        case 'get':
            return auditLogger.ACTION_TYPES.ACCESS;
        case 'put':
        case 'patch':
            return auditLogger.ACTION_TYPES.MODIFY;
        case 'delete':
            return auditLogger.ACTION_TYPES.DELETE;
        default:
            return auditLogger.ACTION_TYPES.ACCESS;
    }
};

/**
 * Extract evidence ID from request
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Evidence ID or null
 */
const getEvidenceId = (req) => {
    // From URL parameters
    if (req.params.evidenceId) {
        return req.params.evidenceId;
    }

    // From request body
    if (req.body?.evidenceId) {
        return req.body.evidenceId;
    }

    // From query parameters
    if (req.query?.evidenceId) {
        return req.query.evidenceId;
    }

    return null;
};

/**
 * Extract case ID from request
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Case ID or null
 */
const getCaseId = (req) => {
    return req.params.caseId ||
        req.body?.caseId ||
        req.query?.caseId ||
        req.caseData?.case_id ||
        null;
};

/**
 * Create audit middleware for evidence endpoints
 * 
 * This middleware intercepts requests to evidence-related endpoints and
 * logs the action asynchronously (non-blocking).
 * 
 * @param {Object} [options={}] - Middleware options
 * @param {boolean} [options.logOnRequest=false] - Log on request (before processing)
 * @param {boolean} [options.logOnResponse=true] - Log on response (after processing)
 * @param {Array<string>} [options.excludePaths=[]] - Paths to exclude from logging
 * @returns {Function} Express middleware function
 */
const createAuditMiddleware = (options = {}) => {
    const {
        logOnRequest = false,
        logOnResponse = true,
        excludePaths = []
    } = options;

    return async (req, res, next) => {
        // Check if path should be excluded
        const shouldExclude = excludePaths.some(path =>
            req.path.includes(path) || req.originalUrl.includes(path)
        );

        if (shouldExclude) {
            return next();
        }

        const startTime = Date.now();
        const userInfo = getUserInfo(req);
        const actionType = getActionType(req.method, req.path);
        const evidenceId = getEvidenceId(req);
        const caseId = getCaseId(req);
        const ipAddress = getClientIp(req);

        // Log on request if enabled
        if (logOnRequest) {
            // Fire-and-forget: don't await
            auditLogger.logAction({
                actionType,
                evidenceId,
                userId: userInfo.userId,
                userRole: userInfo.userRole,
                status: auditLogger.ACTION_STATUS.PENDING,
                details: {
                    method: req.method,
                    path: req.originalUrl,
                    requestBody: req.method !== 'GET' ? sanitizeBody(req.body) : undefined
                },
                ipAddress,
                caseId
            }).catch(err => console.error('[AuditMiddleware] Request log error:', err));
        }

        // Override res.json to capture response and log on completion
        if (logOnResponse) {
            const originalJson = res.json.bind(res);

            res.json = (body) => {
                // Determine status based on response
                const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
                const status = isSuccess
                    ? auditLogger.ACTION_STATUS.SUCCESS
                    : auditLogger.ACTION_STATUS.FAILURE;

                // Extract evidence ID from response if available
                const responseEvidenceId = body?.evidence?.id ||
                    body?.evidence?.evidence_id ||
                    body?.evidenceId ||
                    evidenceId;

                // Fire-and-forget: don't await
                auditLogger.logAction({
                    actionType,
                    evidenceId: responseEvidenceId,
                    userId: userInfo.userId,
                    userRole: userInfo.userRole,
                    status,
                    details: {
                        method: req.method,
                        path: req.originalUrl,
                        statusCode: res.statusCode,
                        responseTime: Date.now() - startTime,
                        error: isSuccess ? undefined : body?.error
                    },
                    ipAddress,
                    caseId
                }).catch(err => console.error('[AuditMiddleware] Response log error:', err));

                // Call original json method
                return originalJson(body);
            };
        }

        next();
    };
};

/**
 * Sanitize request body for logging
 * Removes sensitive fields and truncates large data
 * 
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') {
        return {};
    }

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'fileData', 'file_data'];
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    // Truncate large fields
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
            sanitized[key] = sanitized[key].substring(0, 500) + '...[TRUNCATED]';
        }
    });

    return sanitized;
};

/**
 * Pre-configured middleware for evidence endpoints
 * Automatically logs all evidence-related actions
 */
const evidenceAuditMiddleware = createAuditMiddleware({
    logOnRequest: false,
    logOnResponse: true,
    excludePaths: ['/health', '/api-docs', '/favicon']
});

/**
 * Helper function to manually log an evidence action
 * Use this for logging actions that aren't captured by the middleware
 * 
 * @param {Object} req - Express request object
 * @param {string} actionType - Action type from ACTION_TYPES
 * @param {string} evidenceId - Evidence ID
 * @param {string} status - Status from ACTION_STATUS
 * @param {Object} [details={}] - Additional details
 * @returns {Promise<Object|null>} Log entry or null
 */
const logEvidenceAction = async (req, actionType, evidenceId, status, details = {}) => {
    const userInfo = getUserInfo(req);
    const ipAddress = getClientIp(req);
    const caseId = getCaseId(req);

    return auditLogger.logAction({
        actionType,
        evidenceId,
        userId: userInfo.userId,
        userRole: userInfo.userRole,
        status,
        details,
        ipAddress,
        caseId
    });
};

module.exports = {
    createAuditMiddleware,
    evidenceAuditMiddleware,
    logEvidenceAction,
    getClientIp,
    getUserInfo,
    getActionType,
    getEvidenceId,
    getCaseId
};
