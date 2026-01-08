-- Hybrid RBAC/ABAC Security Schema
-- Extends existing user roles with attribute-based policies

-- Enhanced user attributes table
CREATE TABLE IF NOT EXISTS user_attributes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    department VARCHAR(100),
    jurisdiction VARCHAR(100),
    clearance_level INTEGER DEFAULT 1,
    ip_whitelist TEXT[], -- Array of allowed IP addresses
    device_fingerprints TEXT[], -- Array of trusted device fingerprints
    working_hours_start INTEGER DEFAULT 8,
    working_hours_end INTEGER DEFAULT 18,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security policies table
CREATE TABLE IF NOT EXISTS security_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy_type VARCHAR(50) NOT NULL, -- 'RBAC', 'ABAC', 'HYBRID'
    rules JSONB NOT NULL, -- Policy rules in JSON format
    conditions JSONB, -- Application conditions
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy assignments to roles/users
CREATE TABLE IF NOT EXISTS policy_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id UUID REFERENCES security_policies(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL, -- 'ROLE', 'USER', 'RESOURCE'
    target_id VARCHAR(255) NOT NULL, -- Role name, user ID, or resource type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events and audit log
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, LOW, MEDIUM, HIGH, CRITICAL
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    resource_type VARCHAR(50),
    resource_id UUID,
    action VARCHAR(50),
    policy_result JSONB, -- Policy evaluation result
    attributes JSONB, -- Gathered attributes during evaluation
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious activities tracking
CREATE TABLE IF NOT EXISTS suspicious_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address INET NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    activity_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Geo location tracking for anomaly detection
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    country VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_vpn BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence access policies (extends existing evidence table)
CREATE TABLE IF NOT EXISTS evidence_access_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    case_type VARCHAR(50), -- criminal, civil, juvenile
    sensitivity_level VARCHAR(20) DEFAULT 'public', -- public, confidential, restricted, classified
    jurisdiction VARCHAR(100),
    legal_hold BOOLEAN DEFAULT false,
    access_rules JSONB, -- JSON rules for who can access
    retention_policy JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_attributes_user_id ON user_attributes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_attributes_jurisdiction ON user_attributes(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_ip ON suspicious_activities(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_activities_user_id ON suspicious_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_created_at ON user_locations(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_access_policies_evidence_id ON evidence_access_policies(evidence_id);

-- Row Level Security (RLS) policies
ALTER TABLE user_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_access_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- User attributes: users can see their own, admins can see all
CREATE POLICY "Users can view own attributes" ON user_attributes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attributes" ON user_attributes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'administrator'
        )
    );

-- Security policies: only admins and auditors can manage
CREATE POLICY "Admins can manage security policies" ON security_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'auditor')
        )
    );

-- Security events: users can see their own, admins/auditors can see all
CREATE POLICY "Users can view own security events" ON security_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security events" ON security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'auditor')
        )
    );

-- Functions for policy evaluation
CREATE OR REPLACE FUNCTION evaluate_time_policy(
    user_attrs JSONB,
    current_hour INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_hour >= (user_attrs->>'working_hours_start')::INTEGER 
       AND current_hour <= (user_attrs->>'working_hours_end')::INTEGER;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION evaluate_jurisdiction_policy(
    user_jurisdiction TEXT,
    resource_jurisdiction TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN user_jurisdiction = resource_jurisdiction OR user_jurisdiction = 'GLOBAL';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user_attributes timestamp
CREATE OR REPLACE FUNCTION update_user_attributes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_attributes_timestamp
    BEFORE UPDATE ON user_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_user_attributes_timestamp();

-- Insert default security policies
INSERT INTO security_policies (name, description, policy_type, rules, conditions, priority) VALUES
('Working Hours Policy', 'Restrict access to working hours only', 'ABAC', 
 '{"type": "time_based", "allowed_hours": [8, 18]}', 
 '{"roles": ["investigator", "analyst", "legal"], "actions": ["view", "download"]}', 
 100),

('Jurisdiction Policy', 'Users can only access evidence from their jurisdiction', 'ABAC',
 '{"type": "jurisdiction_based", "cross_jurisdiction": false}',
 '{"roles": ["investigator", "analyst"], "resourceTypes": ["evidence"]}',
 200),

('IP Whitelist Policy', 'Restrict access to whitelisted IPs for sensitive operations', 'ABAC',
 '{"type": "ip_whitelist", "enforce_whitelist": true}',
 '{"actions": ["download", "export", "delete"]}',
 300),

('Admin Override Policy', 'Administrators can access everything', 'RBAC',
 '{"type": "role_override", "override": true}',
 '{"roles": ["administrator"]}',
 1000);

-- Insert default user attributes for existing users
INSERT INTO user_attributes (user_id, department, jurisdiction, clearance_level)
SELECT id, 'General', 'Default', 1 
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM user_attributes WHERE user_id = users.id
);

COMMENT ON TABLE user_attributes IS 'Extended user attributes for ABAC policies';
COMMENT ON TABLE security_policies IS 'Configurable security policies for hybrid RBAC/ABAC';
COMMENT ON TABLE security_events IS 'Audit log for all security-related events';
COMMENT ON TABLE suspicious_activities IS 'Tracking of suspicious user activities';
COMMENT ON TABLE evidence_access_policies IS 'Fine-grained access control for evidence items';