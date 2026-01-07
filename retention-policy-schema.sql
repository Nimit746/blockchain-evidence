-- Evidence Retention Policy Management Schema
-- Add retention policy tables to existing database

-- Retention policies table
CREATE TABLE IF NOT EXISTS retention_policies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    case_type TEXT NOT NULL,
    retention_days INTEGER NOT NULL,
    archive_method TEXT DEFAULT 'delete' CHECK (archive_method IN ('delete', 'archive')),
    jurisdiction TEXT,
    law_reference TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Evidence retention tracking
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS retention_policy_id INTEGER REFERENCES retention_policies(id);
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Retention notifications
CREATE TABLE IF NOT EXISTS retention_notifications (
    id SERIAL PRIMARY KEY,
    evidence_id INTEGER REFERENCES evidence(id),
    notification_type TEXT NOT NULL CHECK (notification_type IN ('30_day_warning', '7_day_warning', '1_day_warning', 'expired')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    sent_to TEXT NOT NULL
);

-- Destroyed evidence audit log
CREATE TABLE IF NOT EXISTS destroyed_evidence (
    id SERIAL PRIMARY KEY,
    original_evidence_id INTEGER NOT NULL,
    evidence_name TEXT NOT NULL,
    case_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    destroyed_by TEXT NOT NULL,
    destruction_reason TEXT NOT NULL,
    destruction_method TEXT NOT NULL,
    destroyed_at TIMESTAMPTZ DEFAULT NOW(),
    approval_by TEXT,
    approval_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_expiry ON evidence(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_legal_hold ON evidence(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON retention_policies(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE destroyed_evidence ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all operations" ON retention_policies FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON retention_notifications FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON destroyed_evidence FOR ALL USING (true);

-- Insert default retention policies
INSERT INTO retention_policies (name, case_type, retention_days, jurisdiction, law_reference, created_by) VALUES
('Criminal Cases - Major', 'criminal_major', 3650, 'India', 'Indian Evidence Act 1872', 'system'),
('Criminal Cases - Minor', 'criminal_minor', 2555, 'India', 'Indian Evidence Act 1872', 'system'),
('Civil Cases', 'civil', 1825, 'India', 'Civil Procedure Code 1908', 'system'),
('Administrative', 'administrative', 1825, 'India', 'Right to Information Act 2005', 'system'),
('Child Welfare', 'child_welfare', 9125, 'India', 'Juvenile Justice Act 2015', 'system'),
('GDPR Personal Data', 'gdpr_personal', 1095, 'EU', 'GDPR Article 17', 'system')
ON CONFLICT DO NOTHING;