/**
 * Centralized Audit Logging Service
 * 
 * This service provides a unified interface for logging all evidence-related
 * actions in the system. It ensures consistent, non-blocking audit trails
 * for security, compliance, and debugging purposes.
 * 
 * @module services/auditLogger.service
 * @author blockchain-evidence team
 * @issue #32 - Add centralized audit logging for evidence-related actions
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://vkqswulxmuuganmjqumb.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcXN3dWx4bXV1Z2FubWpxdW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODc3OTQsImV4cCI6MjA4MjM2Mzc5NH0.LsZKX2aThok0APCNXr9yQ8FnuJnIw6v8RsTIxVLFB4U';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Action types enum for evidence-related operations
 * @readonly
 * @enum {string}
 */
const ACTION_TYPES = {
    CREATE: 'CREATE',
    VERIFY: 'VERIFY',
    ACCESS: 'ACCESS',
    DOWNLOAD: 'DOWNLOAD',
    DELETE: 'DELETE',
    MODIFY: 'MODIFY',
    TRANSFER: 'TRANSFER',
    CHAIN_OF_CUSTODY: 'CHAIN_OF_CUSTODY'
};

/**
 * Status enum for action outcomes
 * @readonly
 * @enum {string}
 */
const ACTION_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    PENDING: 'PENDING'
};

/**
 * User role enum
 * @readonly
 * @enum {string}
 */
const USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    INVESTIGATOR: 'investigator',
    FORENSIC_ANALYST: 'forensic_analyst',
    LEGAL_PROFESSIONAL: 'legal_professional',
    COURT_OFFICIAL: 'court_official',
    EVIDENCE_MANAGER: 'evidence_manager',
    AUDITOR: 'auditor',
    PUBLIC_VIEWER: 'public_viewer'
};

/**
 * Log an evidence-related action to the audit log
 * 
 * This function is designed to be non-blocking (fire-and-forget pattern)
 * to ensure it doesn't impact the performance of the main application flow.
 * 
 * @async
 * @param {Object} params - The audit log parameters
 * @param {string} params.actionType - Type of action (CREATE, VERIFY, ACCESS, DELETE, MODIFY)
 * @param {string|null} params.evidenceId - The ID of the evidence (nullable for failed attempts)
 * @param {string} params.userId - The ID or wallet address of the user performing the action
 * @param {string} params.userRole - The role of the user (admin, user, investigator, etc.)
 * @param {string} params.status - The outcome status (SUCCESS, FAILURE, PENDING)
 * @param {Object} [params.details={}] - Additional context (file size, hash, error message, etc.)
 * @param {string} [params.ipAddress=null] - Source IP address for security tracking
 * @param {string} [params.caseId=null] - Related case ID if applicable
 * @returns {Promise<Object|null>} The created log entry or null if logging failed
 */
const logAction = async ({
    actionType,
    evidenceId = null,
    userId,
    userRole,
    status,
    details = {},
    ipAddress = null,
    caseId = null
}) => {
    try {
        // Validate required parameters
        if (!actionType || !Object.values(ACTION_TYPES).includes(actionType)) {
            console.error(`[AuditLogger] Invalid action type: ${actionType}`);
            return null;
        }

        if (!userId) {
            console.error('[AuditLogger] User ID is required');
            return null;
        }

        if (!status || !Object.values(ACTION_STATUS).includes(status)) {
            console.error(`[AuditLogger] Invalid status: ${status}`);
            return null;
        }

        // Create the audit log entry
        const logEntry = {
            action_type: actionType,
            evidence_id: evidenceId,
            user_id: userId,
            user_role: userRole || 'unknown',
            status: status,
            details: typeof details === 'object' ? details : { message: details },
            ip_address: ipAddress,
            case_id: caseId,
            timestamp: new Date().toISOString()
        };

        // Insert log entry (non-blocking)
        const { data, error } = await supabase
            .from('evidence_audit_logs')
            .insert(logEntry)
            .select()
            .single();

        if (error) {
            // Log to console but don't throw - logging should not break the app
            console.error('[AuditLogger] Failed to create audit log:', error.message);
            // Fallback to console logging for debugging
            console.log('[AuditLogger] Audit entry (fallback):', JSON.stringify(logEntry));
            return null;
        }

        return data;
    } catch (error) {
        // Catch any unexpected errors - logging must never break the main flow
        console.error('[AuditLogger] Unexpected error:', error.message);
        return null;
    }
};

/**
 * Query audit logs with various filters
 * 
 * @async
 * @param {Object} filters - Query filters
 * @param {string} [filters.evidenceId] - Filter by evidence ID
 * @param {string} [filters.userId] - Filter by user ID
 * @param {string} [filters.actionType] - Filter by action type
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.caseId] - Filter by case ID
 * @param {Date|string} [filters.startDate] - Start of date range
 * @param {Date|string} [filters.endDate] - End of date range
 * @param {number} [filters.limit=100] - Maximum number of results
 * @param {number} [filters.offset=0] - Pagination offset
 * @returns {Promise<{logs: Array, count: number, error: string|null}>}
 */
const queryLogs = async (filters = {}) => {
    try {
        const {
            evidenceId,
            userId,
            actionType,
            status,
            caseId,
            startDate,
            endDate,
            limit = 100,
            offset = 0
        } = filters;

        let query = supabase
            .from('evidence_audit_logs')
            .select('*', { count: 'exact' });

        // Apply filters
        if (evidenceId) {
            query = query.eq('evidence_id', evidenceId);
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (actionType) {
            query = query.eq('action_type', actionType);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (caseId) {
            query = query.eq('case_id', caseId);
        }

        if (startDate) {
            query = query.gte('timestamp', new Date(startDate).toISOString());
        }

        if (endDate) {
            query = query.lte('timestamp', new Date(endDate).toISOString());
        }

        // Apply pagination and ordering
        query = query
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('[AuditLogger] Query error:', error.message);
            return { logs: [], count: 0, error: error.message };
        }

        return { logs: data || [], count: count || 0, error: null };
    } catch (error) {
        console.error('[AuditLogger] Unexpected query error:', error.message);
        return { logs: [], count: 0, error: error.message };
    }
};

/**
 * Get audit log summary statistics
 * 
 * @async
 * @param {string} [timeRange='24h'] - Time range for summary (1h, 24h, 7d, 30d)
 * @returns {Promise<Object>} Summary statistics
 */
const getLogSummary = async (timeRange = '24h') => {
    try {
        let startDate = new Date();
        switch (timeRange) {
            case '1h':
                startDate.setHours(startDate.getHours() - 1);
                break;
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate.setHours(startDate.getHours() - 24);
        }

        const { data, error } = await supabase
            .from('evidence_audit_logs')
            .select('action_type, status')
            .gte('timestamp', startDate.toISOString());

        if (error) {
            console.error('[AuditLogger] Summary error:', error.message);
            return { error: error.message };
        }

        // Calculate summary statistics
        const summary = {
            timeRange,
            totalActions: data?.length || 0,
            byActionType: {},
            byStatus: {
                [ACTION_STATUS.SUCCESS]: 0,
                [ACTION_STATUS.FAILURE]: 0,
                [ACTION_STATUS.PENDING]: 0
            }
        };

        // Initialize action type counts
        Object.values(ACTION_TYPES).forEach(type => {
            summary.byActionType[type] = 0;
        });

        // Count actions
        data?.forEach(log => {
            if (summary.byActionType[log.action_type] !== undefined) {
                summary.byActionType[log.action_type]++;
            }
            if (summary.byStatus[log.status] !== undefined) {
                summary.byStatus[log.status]++;
            }
        });

        return summary;
    } catch (error) {
        console.error('[AuditLogger] Unexpected summary error:', error.message);
        return { error: error.message };
    }
};

/**
 * Get audit trail for a specific evidence item
 * 
 * @async
 * @param {string} evidenceId - The evidence ID to get trail for
 * @returns {Promise<{trail: Array, error: string|null}>}
 */
const getEvidenceTrail = async (evidenceId) => {
    if (!evidenceId) {
        return { trail: [], error: 'Evidence ID is required' };
    }

    const result = await queryLogs({ evidenceId, limit: 500 });
    return { trail: result.logs, error: result.error };
};

/**
 * Get user activity log
 * 
 * @async
 * @param {string} userId - The user ID to get activity for
 * @param {number} [limit=50] - Maximum number of results
 * @returns {Promise<{activity: Array, error: string|null}>}
 */
const getUserActivity = async (userId, limit = 50) => {
    if (!userId) {
        return { activity: [], error: 'User ID is required' };
    }

    const result = await queryLogs({ userId, limit });
    return { activity: result.logs, error: result.error };
};

// Export the service
module.exports = {
    logAction,
    queryLogs,
    getLogSummary,
    getEvidenceTrail,
    getUserActivity,
    ACTION_TYPES,
    ACTION_STATUS,
    USER_ROLES
};
