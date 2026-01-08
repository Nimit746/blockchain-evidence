-- Advanced Analytics and Audit Schema
-- Security audit logs, link analysis, and forensic readiness metrics

-- Saved audit filters table
CREATE TABLE IF NOT EXISTS saved_audit_filters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    filters JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log exports table
CREATE TABLE IF NOT EXISTS audit_log_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    export_id UUID NOT NULL UNIQUE,
    format VARCHAR(10) NOT NULL, -- CSV, JSON, XML
    record_count INTEGER NOT NULL,
    filters JSONB,
    exported_by UUID REFERENCES auth.users(id),
    exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_size BIGINT,
    digital_signature JSONB,
    download_count INTEGER DEFAULT 0,
    last_downloaded TIMESTAMP WITH TIME ZONE
);

-- Evidence relationships table (for link analysis)
CREATE TABLE IF NOT EXISTS evidence_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    target_evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- same_evidence, similar_hash, same_location, etc.
    confidence DECIMAL(3,2) DEFAULT 0.0, -- 0.00 to 1.00
    weight DECIMAL(3,2) DEFAULT 0.0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate relationships
    UNIQUE(source_evidence_id, target_evidence_id, relationship_type)
);

-- Case relationships table
CREATE TABLE IF NOT EXISTS case_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    target_case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- linked_evidence, same_person, temporal_proximity
    confidence DECIMAL(3,2) DEFAULT 0.0,
    evidence_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_case_id, target_case_id, relationship_type)
);

-- Link analysis graphs table (cached results)
CREATE TABLE IF NOT EXISTS link_analysis_graphs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    graph_id VARCHAR(32) NOT NULL UNIQUE, -- MD5 hash of options
    options JSONB NOT NULL,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    graph_data JSONB NOT NULL,
    insights JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Forensic readiness metrics table
CREATE TABLE IF NOT EXISTS forensic_readiness_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_date DATE NOT NULL,
    time_range VARCHAR(10) NOT NULL, -- 1d, 7d, 30d, 90d
    
    -- Chain of custody metrics
    total_evidence INTEGER DEFAULT 0,
    complete_chain_count INTEGER DEFAULT 0,
    chain_completion_rate DECIMAL(5,2) DEFAULT 0.0,
    average_handoffs DECIMAL(5,2) DEFAULT 0.0,
    
    -- Provenance metrics
    digital_evidence_count INTEGER DEFAULT 0,
    provenance_count INTEGER DEFAULT 0,
    provenance_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Blockchain metrics
    blockchain_verified_count INTEGER DEFAULT 0,
    blockchain_verification_rate DECIMAL(5,2) DEFAULT 0.0,
    verification_failures INTEGER DEFAULT 0,
    integrity_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Retention metrics
    retention_policy_count INTEGER DEFAULT 0,
    near_expiry_count INTEGER DEFAULT 0,
    past_due_count INTEGER DEFAULT 0,
    retention_compliance_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Access control metrics
    total_access_attempts INTEGER DEFAULT 0,
    denied_attempts INTEGER DEFAULT 0,
    policy_violations INTEGER DEFAULT 0,
    access_success_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Audit metrics
    total_audit_events INTEGER DEFAULT 0,
    critical_events INTEGER DEFAULT 0,
    high_events INTEGER DEFAULT 0,
    audit_coverage DECIMAL(5,2) DEFAULT 0.0,
    
    -- Overall scores
    overall_score DECIMAL(5,2) DEFAULT 0.0,
    overall_grade VARCHAR(1) DEFAULT 'F',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(metric_date, time_range)
);

-- Forensic readiness reports table
CREATE TABLE IF NOT EXISTS forensic_readiness_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL,
    time_range VARCHAR(10) NOT NULL,
    overall_score DECIMAL(5,2) DEFAULT 0.0,
    overall_grade VARCHAR(1) DEFAULT 'F',
    categories JSONB NOT NULL,
    recommendations JSONB,
    trends JSONB,
    compliance JSONB,
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    exported_count INTEGER DEFAULT 0,
    last_exported TIMESTAMP WITH TIME ZONE
);

-- Investigation insights table
CREATE TABLE IF NOT EXISTS investigation_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    insight_type VARCHAR(50) NOT NULL, -- EVIDENCE_CLUSTERS, CROSS_CASE_LINKS, TEMPORAL_PATTERNS
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, LOW, MEDIUM, HIGH, CRITICAL
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB,
    cases_involved UUID[],
    evidence_involved UUID[],
    confidence DECIMAL(3,2) DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, REVIEWED, DISMISSED
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security alert patterns table
CREATE TABLE IF NOT EXISTS security_alert_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL, -- FREQUENCY, SEQUENCE, ANOMALY
    conditions JSONB NOT NULL,
    threshold_value DECIMAL(10,2),
    time_window INTEGER, -- minutes
    alert_severity VARCHAR(20) DEFAULT 'MEDIUM',
    is_active BOOLEAN DEFAULT true,
    trigger_count INTEGER DEFAULT 0,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_audit_filters_user ON saved_audit_filters(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_exports_exported_by ON audit_log_exports(exported_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_exports_exported_at ON audit_log_exports(exported_at);

CREATE INDEX IF NOT EXISTS idx_evidence_relationships_source ON evidence_relationships(source_evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_target ON evidence_relationships(target_evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_type ON evidence_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_confidence ON evidence_relationships(confidence);

CREATE INDEX IF NOT EXISTS idx_case_relationships_source ON case_relationships(source_case_id);
CREATE INDEX IF NOT EXISTS idx_case_relationships_target ON case_relationships(target_case_id);
CREATE INDEX IF NOT EXISTS idx_case_relationships_type ON case_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_link_analysis_graphs_expires ON link_analysis_graphs(expires_at);
CREATE INDEX IF NOT EXISTS idx_link_analysis_graphs_generated ON link_analysis_graphs(generated_at);

CREATE INDEX IF NOT EXISTS idx_forensic_readiness_metrics_date ON forensic_readiness_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_forensic_readiness_metrics_range ON forensic_readiness_metrics(time_range);

CREATE INDEX IF NOT EXISTS idx_forensic_readiness_reports_date ON forensic_readiness_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_forensic_readiness_reports_generated_by ON forensic_readiness_reports(generated_by);

CREATE INDEX IF NOT EXISTS idx_investigation_insights_type ON investigation_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_investigation_insights_severity ON investigation_insights(severity);
CREATE INDEX IF NOT EXISTS idx_investigation_insights_status ON investigation_insights(status);
CREATE INDEX IF NOT EXISTS idx_investigation_insights_created_at ON investigation_insights(created_at);

CREATE INDEX IF NOT EXISTS idx_security_alert_patterns_active ON security_alert_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_security_alert_patterns_type ON security_alert_patterns(pattern_type);

-- Row Level Security (RLS)
ALTER TABLE saved_audit_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_analysis_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_readiness_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_readiness_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alert_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Saved audit filters: users can manage their own
CREATE POLICY "Users can manage own audit filters" ON saved_audit_filters
    FOR ALL USING (created_by = auth.uid());

-- Audit log exports: users can see their own, admins can see all
CREATE POLICY "Users can view own exports" ON audit_log_exports
    FOR SELECT USING (exported_by = auth.uid());

CREATE POLICY "Admins can view all exports" ON audit_log_exports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'auditor')
        )
    );

-- Evidence relationships: same as evidence access
CREATE POLICY "Evidence relationships access" ON evidence_relationships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM evidence e1
            JOIN cases c1 ON e1.case_id = c1.id
            WHERE e1.id = evidence_relationships.source_evidence_id
            AND (
                c1.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'auditor', 'evidence_manager')
                )
            )
        )
    );

-- Case relationships: same as case access
CREATE POLICY "Case relationships access" ON case_relationships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id = case_relationships.source_case_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'auditor', 'evidence_manager')
                )
            )
        )
    );

-- Link analysis graphs: analysts and above can access
CREATE POLICY "Analysts can access link analysis" ON link_analysis_graphs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('administrator', 'auditor', 'evidence_manager', 'analyst')
        )
    );

-- Forensic readiness: admins and auditors only
CREATE POLICY "Admins can access forensic readiness" ON forensic_readiness_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'auditor')
        )
    );

CREATE POLICY "Admins can access readiness reports" ON forensic_readiness_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'auditor')
        )
    );

-- Investigation insights: investigators and above can access
CREATE POLICY "Investigators can access insights" ON investigation_insights
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('administrator', 'auditor', 'evidence_manager', 'analyst', 'investigator')
        )
    );

-- Security alert patterns: admins only
CREATE POLICY "Admins can manage alert patterns" ON security_alert_patterns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'administrator'
        )
    );

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_evidence_similarity(
    evidence1_id UUID,
    evidence2_id UUID
) RETURNS DECIMAL AS $$
DECLARE
    similarity DECIMAL := 0.0;
    e1_hash VARCHAR;
    e2_hash VARCHAR;
    e1_metadata JSONB;
    e2_metadata JSONB;
BEGIN
    -- Get evidence data
    SELECT file_hash, metadata INTO e1_hash, e1_metadata
    FROM evidence WHERE id = evidence1_id;
    
    SELECT file_hash, metadata INTO e2_hash, e2_metadata
    FROM evidence WHERE id = evidence2_id;
    
    -- Calculate hash similarity (simplified)
    IF e1_hash = e2_hash THEN
        similarity := 1.0;
    ELSIF e1_hash IS NOT NULL AND e2_hash IS NOT NULL THEN
        -- Simple character comparison (in production, use proper hash comparison)
        similarity := 0.5;
    END IF;
    
    RETURN similarity;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_evidence_clusters(
    min_cluster_size INTEGER DEFAULT 3,
    similarity_threshold DECIMAL DEFAULT 0.7
) RETURNS TABLE (
    cluster_id INTEGER,
    evidence_ids UUID[],
    cluster_size INTEGER,
    avg_similarity DECIMAL
) AS $$
BEGIN
    -- Simplified clustering algorithm
    -- In production, implement proper graph clustering
    RETURN QUERY
    WITH evidence_pairs AS (
        SELECT 
            er.source_evidence_id,
            er.target_evidence_id,
            er.confidence
        FROM evidence_relationships er
        WHERE er.confidence >= similarity_threshold
    ),
    clusters AS (
        SELECT 
            ROW_NUMBER() OVER () as cluster_id,
            ARRAY[source_evidence_id, target_evidence_id] as evidence_ids,
            2 as cluster_size,
            confidence as avg_similarity
        FROM evidence_pairs
    )
    SELECT 
        c.cluster_id::INTEGER,
        c.evidence_ids,
        c.cluster_size,
        c.avg_similarity
    FROM clusters c
    WHERE c.cluster_size >= min_cluster_size;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired data
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up expired link analysis graphs
    DELETE FROM link_analysis_graphs 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old forensic readiness metrics (keep last 90 days)
    DELETE FROM forensic_readiness_metrics 
    WHERE metric_date < CURRENT_DATE - INTERVAL '90 days';
    
    -- Clean up old audit exports (keep last 30 days)
    DELETE FROM audit_log_exports 
    WHERE exported_at < NOW() - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_saved_audit_filters_timestamp
    BEFORE UPDATE ON saved_audit_filters
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_timestamp();

-- Insert sample data for testing
INSERT INTO investigation_insights (insight_type, severity, title, description, data, confidence)
VALUES 
('EVIDENCE_CLUSTERS', 'HIGH', 'Evidence Cluster Detected', 'Multiple evidence items show strong relationships', 
 '{"cluster_size": 5, "evidence_types": ["image", "video"], "similarity": 0.85}', 0.85),
('CROSS_CASE_LINKS', 'CRITICAL', 'Cross-Case Evidence Link', 'Same evidence appears in multiple cases', 
 '{"cases": 3, "evidence_type": "image", "hash_match": true}', 0.95),
('TEMPORAL_PATTERNS', 'MEDIUM', 'Temporal Activity Pattern', 'Evidence shows time-based clustering', 
 '{"time_window": "14:00-16:00", "evidence_count": 8, "pattern_strength": 0.7}', 0.70);

-- Insert sample security alert patterns
INSERT INTO security_alert_patterns (pattern_name, pattern_type, conditions, threshold_value, time_window, alert_severity)
VALUES 
('Failed Login Attempts', 'FREQUENCY', '{"event_type": "LOGIN_FAILED", "same_ip": true}', 5, 15, 'HIGH'),
('Rapid Evidence Downloads', 'FREQUENCY', '{"action": "download", "resource_type": "evidence"}', 10, 5, 'MEDIUM'),
('Cross-Jurisdiction Access', 'ANOMALY', '{"cross_jurisdiction": true, "resource_type": "evidence"}', 1, 60, 'HIGH');

COMMENT ON TABLE saved_audit_filters IS 'User-saved filters for audit log searches';
COMMENT ON TABLE audit_log_exports IS 'Exported audit log files with digital signatures';
COMMENT ON TABLE evidence_relationships IS 'Relationships between evidence items for link analysis';
COMMENT ON TABLE case_relationships IS 'Relationships between cases based on shared evidence or patterns';
COMMENT ON TABLE link_analysis_graphs IS 'Cached link analysis graph results';
COMMENT ON TABLE forensic_readiness_metrics IS 'NIST-aligned forensic readiness metrics over time';
COMMENT ON TABLE forensic_readiness_reports IS 'Generated forensic readiness compliance reports';
COMMENT ON TABLE investigation_insights IS 'AI-generated insights from cross-case analysis';
COMMENT ON TABLE security_alert_patterns IS 'Configurable patterns for security alerting';