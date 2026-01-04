# Centralized Audit Logging for Evidence-Related Actions

> Issue #32 - Implementation Documentation

## 📋 Overview

This feature introduces a centralized audit logging mechanism to record important evidence lifecycle events in the blockchain-evidence system. The implementation follows security and compliance best practices while ensuring non-blocking, lightweight logging.

## 🎯 Features Implemented

### Logged Actions

| Action Type | Description | Trigger Points |
|-------------|-------------|----------------|
| `CREATE` | Evidence creation/upload | POST `/api/cases/:caseId/evidence` |
| `VERIFY` | Evidence verification | POST `/api/evidence/:id/verify` |
| `ACCESS` | Evidence view/access | GET `/api/cases/:caseId/evidence` |
| `DOWNLOAD` | Evidence download | GET `/api/evidence/:id/download` |
| `DELETE` | Evidence deletion | DELETE `/api/evidence/:id` |
| `MODIFY` | Evidence modification | PUT/PATCH `/api/evidence/:id` |
| `TRANSFER` | Evidence custody transfer | POST `/api/evidence/:id/transfer` |
| `CHAIN_OF_CUSTODY` | Chain of custody updates | Any custody-related action |

### Log Entry Structure

Each audit log entry contains:

```json
{
  "id": "uuid",
  "timestamp": "2024-01-04T12:00:00.000Z",
  "action_type": "CREATE|VERIFY|ACCESS|DOWNLOAD|DELETE|MODIFY|TRANSFER|CHAIN_OF_CUSTODY",
  "evidence_id": "EVID-2024-001",
  "case_id": "CASE-2024-001",
  "user_id": "0x...",
  "user_role": "admin|investigator|forensic_analyst|...",
  "status": "SUCCESS|FAILURE|PENDING",
  "details": {
    "title": "Evidence title",
    "fileHash": "sha256:...",
    "error": "Error message if failed"
  },
  "ip_address": "192.168.1.1"
}
```

## 🏗️ Architecture

### Directory Structure

```
blockchain-evidence/
├── services/
│   └── auditLogger.service.js     # Core audit logging service
├── middlewares/
│   └── auditLogger.middleware.js  # Express middleware for automatic logging
├── routes/
│   └── auditLogs.routes.js        # REST API for querying audit logs
├── migrations/
│   └── 001_create_evidence_audit_logs.sql  # Database schema
├── tests/
│   └── auditLogger.test.js        # Unit tests
└── AUDIT_LOGGING.md               # This documentation
```

### Core Components

#### 1. Audit Logger Service (`services/auditLogger.service.js`)

The main service providing:
- `logAction()` - Log an evidence-related action
- `queryLogs()` - Query audit logs with filters
- `getLogSummary()` - Get summary statistics
- `getEvidenceTrail()` - Get audit trail for a specific evidence
- `getUserActivity()` - Get user activity log

#### 2. Audit Logger Middleware (`middlewares/auditLogger.middleware.js`)

Express middleware providing:
- Automatic logging for evidence endpoints
- Non-blocking (fire-and-forget) logging
- IP address extraction
- User info extraction
- Action type detection from HTTP method/path

#### 3. Database Schema (`migrations/001_create_evidence_audit_logs.sql`)

Supabase table with:
- Optimized indexes for common query patterns
- Row Level Security (RLS) policies
- Immutability (no updates/deletes)
- JSONB details field for flexible metadata

## 📚 API Reference

### Query Audit Logs

```http
GET /api/audit-logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `evidenceId` | string | Filter by evidence ID |
| `userId` | string | Filter by user ID |
| `actionType` | string | Filter by action type |
| `status` | string | Filter by status |
| `caseId` | string | Filter by case ID |
| `startDate` | datetime | Start of date range |
| `endDate` | datetime | End of date range |
| `limit` | integer | Max results (default: 100) |
| `offset` | integer | Pagination offset |

**Response:**
```json
{
  "success": true,
  "logs": [...],
  "count": 150,
  "pagination": {
    "limit": 100,
    "offset": 0
  }
}
```

### Get Audit Summary

```http
GET /api/audit-logs/summary?timeRange=24h
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "timeRange": "24h",
    "totalActions": 150,
    "byActionType": {
      "CREATE": 45,
      "ACCESS": 80,
      "VERIFY": 15,
      "MODIFY": 10
    },
    "byStatus": {
      "SUCCESS": 145,
      "FAILURE": 5,
      "PENDING": 0
    }
  }
}
```

### Get Evidence Trail

```http
GET /api/audit-logs/evidence/:evidenceId
```

**Response:**
```json
{
  "success": true,
  "evidenceId": "EVID-2024-001",
  "trail": [...],
  "count": 12
}
```

### Get User Activity

```http
GET /api/audit-logs/user/:userId?limit=50
```

**Response:**
```json
{
  "success": true,
  "userId": "0x...",
  "activity": [...],
  "count": 50
}
```

## 🛠️ Usage Examples

### Manual Logging in Endpoint

```javascript
const auditLogger = require('./services/auditLogger.service');

// In your endpoint handler
await auditLogger.logAction({
    actionType: auditLogger.ACTION_TYPES.CREATE,
    evidenceId: 'EVID-2024-001',
    userId: user.wallet_address,
    userRole: user.role,
    status: auditLogger.ACTION_STATUS.SUCCESS,
    details: {
        title: 'Evidence Title',
        fileHash: 'sha256:abc123...',
        fileSize: 1024
    },
    ipAddress: req.ip,
    caseId: 'CASE-2024-001'
});
```

### Using Middleware

```javascript
const { evidenceAuditMiddleware } = require('./middlewares/auditLogger.middleware');

// Apply to specific routes
app.use('/api/cases/:caseId/evidence', evidenceAuditMiddleware);
```

### Querying Logs

```javascript
const auditLogger = require('./services/auditLogger.service');

// Get all logs for an evidence item
const { trail, error } = await auditLogger.getEvidenceTrail('EVID-2024-001');

// Get user activity
const { activity } = await auditLogger.getUserActivity('0x123...', 50);

// Query with filters
const { logs, count } = await auditLogger.queryLogs({
    actionType: 'CREATE',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    limit: 100
});
```

## 📊 Database Migration

Run the migration script in Supabase SQL Editor:

```sql
-- Run the migration file
\i migrations/001_create_evidence_audit_logs.sql
```

Or copy and paste the contents of `migrations/001_create_evidence_audit_logs.sql` into the Supabase SQL Editor.

## ⚡ Performance Considerations

1. **Non-Blocking Logging**: Uses fire-and-forget pattern - logging failures don't affect main flow
2. **Indexed Queries**: Optimized indexes for common query patterns
3. **Connection Pooling**: Leverages Supabase's built-in connection pooling
4. **Data Truncation**: Large fields (like descriptions) are truncated in logs
5. **Sensitive Data Redaction**: Passwords, tokens, and file data are redacted

## 🔒 Security Features

1. **Immutable Logs**: RLS policies prevent updates and deletes
2. **IP Tracking**: Client IP captured for security analysis
3. **Role-Based Access**: Only admins/auditors can view logs
4. **Sensitive Data Redaction**: Automatic redaction of sensitive fields

## 🧪 Testing

```bash
# Run tests
npm test -- --testPathPattern=auditLogger

# Run with coverage
npm test -- --coverage --testPathPattern=auditLogger
```

## 📝 Changelog

### v1.0.0 (Issue #32)
- Initial implementation of centralized audit logging
- Added audit logger service with full CRUD logging
- Added Express middleware for automatic logging
- Added REST API endpoints for log queries
- Added database migration script
- Added comprehensive test suite
- Updated evidence endpoints with audit logging

## 🤝 Contributing

When adding new evidence-related endpoints:

1. Import the audit logger service
2. Add `logAction()` calls for success and failure cases
3. Use appropriate `ACTION_TYPES` and `ACTION_STATUS`
4. Include relevant details in the `details` object
5. Add tests for the new logging

---

**Issue:** #32 - Add centralized audit logging for evidence-related actions  
**Author:** blockchain-evidence team  
**Date:** January 2026
