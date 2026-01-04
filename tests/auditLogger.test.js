/**
 * Audit Logger Service Tests
 * 
 * Test suite for centralized audit logging functionality.
 * 
 * @module tests/auditLogger.test
 * @author blockchain-evidence team
 * @issue #32 - Add centralized audit logging for evidence-related actions
 */

const auditLogger = require('../services/auditLogger.service');

// Mock console methods for testing
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
    console.error = jest.fn();
    console.log = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
});

describe('Audit Logger Service', () => {
    describe('ACTION_TYPES', () => {
        it('should export all required action types', () => {
            expect(auditLogger.ACTION_TYPES).toBeDefined();
            expect(auditLogger.ACTION_TYPES.CREATE).toBe('CREATE');
            expect(auditLogger.ACTION_TYPES.VERIFY).toBe('VERIFY');
            expect(auditLogger.ACTION_TYPES.ACCESS).toBe('ACCESS');
            expect(auditLogger.ACTION_TYPES.DOWNLOAD).toBe('DOWNLOAD');
            expect(auditLogger.ACTION_TYPES.DELETE).toBe('DELETE');
            expect(auditLogger.ACTION_TYPES.MODIFY).toBe('MODIFY');
            expect(auditLogger.ACTION_TYPES.TRANSFER).toBe('TRANSFER');
            expect(auditLogger.ACTION_TYPES.CHAIN_OF_CUSTODY).toBe('CHAIN_OF_CUSTODY');
        });
    });

    describe('ACTION_STATUS', () => {
        it('should export all required status types', () => {
            expect(auditLogger.ACTION_STATUS).toBeDefined();
            expect(auditLogger.ACTION_STATUS.SUCCESS).toBe('SUCCESS');
            expect(auditLogger.ACTION_STATUS.FAILURE).toBe('FAILURE');
            expect(auditLogger.ACTION_STATUS.PENDING).toBe('PENDING');
        });
    });

    describe('USER_ROLES', () => {
        it('should export all required user roles', () => {
            expect(auditLogger.USER_ROLES).toBeDefined();
            expect(auditLogger.USER_ROLES.ADMIN).toBe('admin');
            expect(auditLogger.USER_ROLES.INVESTIGATOR).toBe('investigator');
            expect(auditLogger.USER_ROLES.FORENSIC_ANALYST).toBe('forensic_analyst');
            expect(auditLogger.USER_ROLES.AUDITOR).toBe('auditor');
        });
    });

    describe('logAction', () => {
        it('should return null for invalid action type', async () => {
            const result = await auditLogger.logAction({
                actionType: 'INVALID_TYPE',
                userId: 'test-user',
                status: 'SUCCESS'
            });
            expect(result).toBeNull();
        });

        it('should return null for missing userId', async () => {
            const result = await auditLogger.logAction({
                actionType: 'CREATE',
                status: 'SUCCESS'
            });
            expect(result).toBeNull();
        });

        it('should return null for invalid status', async () => {
            const result = await auditLogger.logAction({
                actionType: 'CREATE',
                userId: 'test-user',
                status: 'INVALID_STATUS'
            });
            expect(result).toBeNull();
        });

        it('should accept valid log entry parameters', async () => {
            // This test verifies the function doesn't throw with valid params
            // Actual DB interaction is tested in integration tests
            const params = {
                actionType: auditLogger.ACTION_TYPES.CREATE,
                evidenceId: 'EVID-2024-001',
                userId: '0x1234567890abcdef1234567890abcdef12345678',
                userRole: auditLogger.USER_ROLES.INVESTIGATOR,
                status: auditLogger.ACTION_STATUS.SUCCESS,
                details: { title: 'Test Evidence', fileSize: 1024 },
                ipAddress: '192.168.1.1',
                caseId: 'CASE-2024-001'
            };

            // Should not throw
            await expect(auditLogger.logAction(params)).resolves.not.toThrow();
        });
    });

    describe('queryLogs', () => {
        it('should return logs array and count', async () => {
            const result = await auditLogger.queryLogs({});
            expect(result).toHaveProperty('logs');
            expect(result).toHaveProperty('count');
            expect(Array.isArray(result.logs)).toBe(true);
        });

        it('should apply filters correctly', async () => {
            const result = await auditLogger.queryLogs({
                actionType: 'CREATE',
                limit: 10,
                offset: 0
            });
            expect(result).toHaveProperty('logs');
        });
    });

    describe('getLogSummary', () => {
        it('should return summary for valid time range', async () => {
            const summary = await auditLogger.getLogSummary('24h');
            expect(summary).toHaveProperty('timeRange');
            expect(summary.timeRange).toBe('24h');
        });

        it('should handle different time ranges', async () => {
            const ranges = ['1h', '24h', '7d', '30d'];
            for (const range of ranges) {
                const summary = await auditLogger.getLogSummary(range);
                expect(summary.timeRange).toBe(range);
            }
        });
    });

    describe('getEvidenceTrail', () => {
        it('should return error for missing evidenceId', async () => {
            const result = await auditLogger.getEvidenceTrail();
            expect(result.error).toBe('Evidence ID is required');
        });

        it('should return trail array for valid evidenceId', async () => {
            const result = await auditLogger.getEvidenceTrail('EVID-TEST-001');
            expect(result).toHaveProperty('trail');
            expect(Array.isArray(result.trail)).toBe(true);
        });
    });

    describe('getUserActivity', () => {
        it('should return error for missing userId', async () => {
            const result = await auditLogger.getUserActivity();
            expect(result.error).toBe('User ID is required');
        });

        it('should return activity array for valid userId', async () => {
            const result = await auditLogger.getUserActivity('test-user');
            expect(result).toHaveProperty('activity');
            expect(Array.isArray(result.activity)).toBe(true);
        });
    });
});

describe('Audit Logger Middleware', () => {
    const middleware = require('../middlewares/auditLogger.middleware');

    describe('getClientIp', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const req = {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
                connection: { remoteAddress: '127.0.0.1' }
            };
            expect(middleware.getClientIp(req)).toBe('192.168.1.1');
        });

        it('should fallback to x-real-ip header', () => {
            const req = {
                headers: { 'x-real-ip': '192.168.1.2' },
                connection: { remoteAddress: '127.0.0.1' }
            };
            expect(middleware.getClientIp(req)).toBe('192.168.1.2');
        });

        it('should fallback to connection remoteAddress', () => {
            const req = {
                headers: {},
                connection: { remoteAddress: '127.0.0.1' }
            };
            expect(middleware.getClientIp(req)).toBe('127.0.0.1');
        });
    });

    describe('getUserInfo', () => {
        it('should extract user from req.user', () => {
            const req = {
                user: {
                    wallet_address: '0x123',
                    role: 'admin'
                },
                headers: {}
            };
            const info = middleware.getUserInfo(req);
            expect(info.userId).toBe('0x123');
            expect(info.userRole).toBe('admin');
        });

        it('should fallback to header-based identification', () => {
            const req = {
                headers: { 'x-user-wallet': '0x456' }
            };
            const info = middleware.getUserInfo(req);
            expect(info.userId).toBe('0x456');
        });
    });

    describe('getActionType', () => {
        it('should map POST to CREATE', () => {
            expect(middleware.getActionType('POST', '/evidence')).toBe('CREATE');
        });

        it('should map GET to ACCESS', () => {
            expect(middleware.getActionType('GET', '/evidence')).toBe('ACCESS');
        });

        it('should map DELETE to DELETE', () => {
            expect(middleware.getActionType('DELETE', '/evidence')).toBe('DELETE');
        });

        it('should detect verify action in path', () => {
            expect(middleware.getActionType('POST', '/evidence/verify')).toBe('VERIFY');
        });

        it('should detect download action in path', () => {
            expect(middleware.getActionType('GET', '/evidence/download')).toBe('DOWNLOAD');
        });
    });

    describe('getEvidenceId', () => {
        it('should extract from params', () => {
            const req = {
                params: { evidenceId: 'EVID-001' },
                body: {},
                query: {}
            };
            expect(middleware.getEvidenceId(req)).toBe('EVID-001');
        });

        it('should extract from body', () => {
            const req = {
                params: {},
                body: { evidenceId: 'EVID-002' },
                query: {}
            };
            expect(middleware.getEvidenceId(req)).toBe('EVID-002');
        });

        it('should extract from query', () => {
            const req = {
                params: {},
                body: {},
                query: { evidenceId: 'EVID-003' }
            };
            expect(middleware.getEvidenceId(req)).toBe('EVID-003');
        });
    });
});
