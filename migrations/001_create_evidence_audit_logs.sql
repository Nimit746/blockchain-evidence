-- Migration: Create Evidence Audit Logs Table
-- Issue #32 - Add centralized audit logging for evidence-related actions
-- Run this in Supabase SQL Editor

-- Create evidence_audit_logs table for centralized audit logging
CREATE TABLE IF NOT EXISTS evidence_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Timestamp (ISO 8601 format, UTC)
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Action type (CREATE, VERIFY, ACCESS, DOWNLOAD, DELETE, MODIFY, TRANSFER, CHAIN_OF_CUSTODY)
    action_type TEXT NOT NULL CHECK (action_type IN (
        'CREATE', 
        'VERIFY', 
        'ACCESS', 
        'DOWNLOAD',
        'DELETE', 
        'MODIFY', 
        'TRANSFER',
        'CHAIN_OF_CUSTODY'
    )),
    
    -- Evidence reference (nullable for failed attempts)
    evidence_id TEXT,
    
    -- Case reference
    case_id TEXT,
    
    -- User information
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL CHECK (user_role IN (
        'admin',
        'user',
        'investigator',
        'forensic_analyst',
        'legal_professional',
        'court_official',
        'evidence_manager',
        'auditor',
        'public_viewer',
        'unknown'
    )),
    
    -- Action outcome
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'PENDING')),
    
    -- Additional context (file size, hash, error message, etc.)
    details JSONB DEFAULT '{}'::jsonb,
    
    -- Source IP for security tracking
    ip_address TEXT,
    
    -- Index timestamp for efficient querying
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
-- Index on timestamp for time-range queries
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_timestamp 
    ON evidence_audit_logs(timestamp DESC);

-- Index on evidence_id for evidence trail queries
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_evidence_id 
    ON evidence_audit_logs(evidence_id) 
    WHERE evidence_id IS NOT NULL;

-- Index on user_id for user activity queries
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_user_id 
    ON evidence_audit_logs(user_id);

-- Index on action_type for action filtering
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_action_type 
    ON evidence_audit_logs(action_type);

-- Index on case_id for case-related queries
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_case_id 
    ON evidence_audit_logs(case_id) 
    WHERE case_id IS NOT NULL;

-- Index on status for status filtering
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_status 
    ON evidence_audit_logs(status);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_evidence_audit_logs_user_action_time 
    ON evidence_audit_logs(user_id, action_type, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE evidence_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for read access (admins and auditors only)
DROP POLICY IF EXISTS "audit_logs_read_policy" ON evidence_audit_logs;
CREATE POLICY "audit_logs_read_policy" ON evidence_audit_logs
    FOR SELECT
    USING (true); -- In production, restrict to admin/auditor roles

-- Create policy for insert access (system can always insert)
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON evidence_audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON evidence_audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Prevent updates and deletes on audit logs (immutability)
DROP POLICY IF EXISTS "audit_logs_update_policy" ON evidence_audit_logs;
CREATE POLICY "audit_logs_update_policy" ON evidence_audit_logs
    FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "audit_logs_delete_policy" ON evidence_audit_logs;
CREATE POLICY "audit_logs_delete_policy" ON evidence_audit_logs
    FOR DELETE
    USING (false);

-- Add comments for documentation
COMMENT ON TABLE evidence_audit_logs IS 'Centralized audit log for all evidence-related actions in the system';
COMMENT ON COLUMN evidence_audit_logs.action_type IS 'Type of action: CREATE, VERIFY, ACCESS, DOWNLOAD, DELETE, MODIFY, TRANSFER, CHAIN_OF_CUSTODY';
COMMENT ON COLUMN evidence_audit_logs.evidence_id IS 'Reference to the evidence item (nullable for failed attempts)';
COMMENT ON COLUMN evidence_audit_logs.user_role IS 'Role of the user performing the action';
COMMENT ON COLUMN evidence_audit_logs.status IS 'Outcome of the action: SUCCESS, FAILURE, PENDING';
COMMENT ON COLUMN evidence_audit_logs.details IS 'Additional context in JSON format (file size, hash, error message, etc.)';
COMMENT ON COLUMN evidence_audit_logs.ip_address IS 'Source IP address for security tracking';

-- Grant permissions
GRANT SELECT ON evidence_audit_logs TO authenticated;
GRANT INSERT ON evidence_audit_logs TO authenticated;
GRANT SELECT ON evidence_audit_logs TO anon;
GRANT INSERT ON evidence_audit_logs TO anon;
