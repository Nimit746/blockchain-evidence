/**
 * Audit Logs API Routes
 * 
 * Provides endpoints for querying and viewing audit logs.
 * Access is restricted to admins and auditors.
 * 
 * @module routes/auditLogs.routes
 * @author blockchain-evidence team
 * @issue #32 - Add centralized audit logging for evidence-related actions
 */

const express = require('express');
const auditLogger = require('../services/auditLogger.service');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         timestamp:
 *           type: string
 *           format: date-time
 *         action_type:
 *           type: string
 *           enum: [CREATE, VERIFY, ACCESS, DOWNLOAD, DELETE, MODIFY, TRANSFER, CHAIN_OF_CUSTODY]
 *         evidence_id:
 *           type: string
 *         case_id:
 *           type: string
 *         user_id:
 *           type: string
 *         user_role:
 *           type: string
 *         status:
 *           type: string
 *           enum: [SUCCESS, FAILURE, PENDING]
 *         details:
 *           type: object
 *         ip_address:
 *           type: string
 */

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Query audit logs with filters (Admin/Auditor only)
 *     tags: [Audit Logs]
 *     security:
 *       - UserWallet: []
 *     parameters:
 *       - in: query
 *         name: evidenceId
 *         schema:
 *           type: string
 *         description: Filter by evidence ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *           enum: [CREATE, VERIFY, ACCESS, DOWNLOAD, DELETE, MODIFY, TRANSFER, CHAIN_OF_CUSTODY]
 *         description: Filter by action type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUCCESS, FAILURE, PENDING]
 *         description: Filter by status
 *       - in: query
 *         name: caseId
 *         schema:
 *           type: string
 *         description: Filter by case ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of date range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of date range
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin/Auditor access required
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
    try {
        // Extract filters from query parameters
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
        } = req.query;

        const result = await auditLogger.queryLogs({
            evidenceId,
            userId,
            actionType,
            status,
            caseId,
            startDate,
            endDate,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });

        if (result.error) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            logs: result.logs,
            count: result.count,
            pagination: {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs'
        });
    }
});

/**
 * @swagger
 * /api/audit-logs/summary:
 *   get:
 *     summary: Get audit log summary statistics (Admin/Auditor only)
 *     tags: [Audit Logs]
 *     security:
 *       - UserWallet: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for summary
 *     responses:
 *       200:
 *         description: Audit log summary
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;

        const summary = await auditLogger.getLogSummary(timeRange);

        if (summary.error) {
            return res.status(500).json({
                success: false,
                error: summary.error
            });
        }

        res.json({
            success: true,
            summary
        });
    } catch (error) {
        console.error('Get audit summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit summary'
        });
    }
});

/**
 * @swagger
 * /api/audit-logs/evidence/{evidenceId}:
 *   get:
 *     summary: Get complete audit trail for an evidence item (Admin/Auditor only)
 *     tags: [Audit Logs]
 *     security:
 *       - UserWallet: []
 *     parameters:
 *       - in: path
 *         name: evidenceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Evidence ID to get trail for
 *     responses:
 *       200:
 *         description: Evidence audit trail
 *       400:
 *         description: Evidence ID required
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/evidence/:evidenceId', async (req, res) => {
    try {
        const { evidenceId } = req.params;

        if (!evidenceId) {
            return res.status(400).json({
                success: false,
                error: 'Evidence ID is required'
            });
        }

        const result = await auditLogger.getEvidenceTrail(evidenceId);

        if (result.error) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            evidenceId,
            trail: result.trail,
            count: result.trail.length
        });
    } catch (error) {
        console.error('Get evidence trail error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve evidence trail'
        });
    }
});

/**
 * @swagger
 * /api/audit-logs/user/{userId}:
 *   get:
 *     summary: Get activity log for a user (Admin/Auditor only)
 *     tags: [Audit Logs]
 *     security:
 *       - UserWallet: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or wallet address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: User activity log
 *       400:
 *         description: User ID required
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await auditLogger.getUserActivity(userId, parseInt(limit, 10));

        if (result.error) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            userId,
            activity: result.activity,
            count: result.activity.length
        });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user activity'
        });
    }
});

module.exports = router;
