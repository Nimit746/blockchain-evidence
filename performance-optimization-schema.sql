-- Performance Optimization Schema
-- Storage tiering, progressive previews, and performance metrics

-- Storage tiers configuration
CREATE TABLE IF NOT EXISTS storage_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tier_name VARCHAR(20) NOT NULL UNIQUE, -- HOT, WARM, COLD
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    cost_per_gb DECIMAL(6,4) NOT NULL, -- USD per GB per month
    access_latency INTEGER NOT NULL, -- milliseconds
    max_age_days INTEGER, -- NULL for indefinite
    color VARCHAR(7) DEFAULT '#cccccc',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage tiering policies
CREATE TABLE IF NOT EXISTS storage_tiering_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL, -- JSON conditions for policy matching
    target_tier VARCHAR(20) REFERENCES storage_tiers(tier_name),
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage migrations tracking
CREATE TABLE IF NOT EXISTS storage_migrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    from_tier VARCHAR(20),
    to_tier VARCHAR(20),
    reason TEXT,
    file_size BIGINT,
    estimated_cost_change DECIMAL(10,4), -- Monthly cost change
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Storage events log
CREATE TABLE IF NOT EXISTS storage_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- TIER_MIGRATION, COST_ANALYSIS, POLICY_APPLIED
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    from_tier VARCHAR(20),
    to_tier VARCHAR(20),
    reason TEXT,
    file_size BIGINT,
    cost_impact DECIMAL(10,4),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence access log (for performance tracking)
CREATE TABLE IF NOT EXISTS evidence_access_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    access_type VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, PREVIEW, STREAM
    access_latency INTEGER, -- milliseconds
    bytes_transferred BIGINT,
    client_info JSONB, -- User agent, connection speed, device type
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progressive previews cache
CREATE TABLE IF NOT EXISTS evidence_previews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    preview_type VARCHAR(20) NOT NULL, -- thumbnail, small, medium, large, progressive
    preview_data BYTEA, -- Actual preview image data
    preview_size INTEGER,
    width INTEGER,
    height INTEGER,
    format VARCHAR(20),
    quality INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    
    UNIQUE(evidence_id, preview_type)
);

-- Streaming chunks cache
CREATE TABLE IF NOT EXISTS evidence_streaming_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    start_byte BIGINT NOT NULL,
    end_byte BIGINT NOT NULL,
    chunk_size INTEGER NOT NULL,
    chunk_hash VARCHAR(64), -- SHA-256 hash of chunk
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    access_count INTEGER DEFAULT 0,
    
    UNIQUE(evidence_id, chunk_index)
);

-- Performance metrics aggregation
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_hour INTEGER, -- 0-23, NULL for daily aggregation
    
    -- Storage metrics
    total_storage_gb DECIMAL(12,4) DEFAULT 0,
    hot_storage_gb DECIMAL(12,4) DEFAULT 0,
    warm_storage_gb DECIMAL(12,4) DEFAULT 0,
    cold_storage_gb DECIMAL(12,4) DEFAULT 0,
    total_storage_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Access metrics
    total_accesses INTEGER DEFAULT 0,
    avg_access_latency DECIMAL(8,2) DEFAULT 0,
    total_bytes_transferred BIGINT DEFAULT 0,
    cache_hit_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Preview metrics
    preview_generations INTEGER DEFAULT 0,
    preview_cache_size BIGINT DEFAULT 0,
    streaming_sessions INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(metric_date, metric_hour)
);

-- Storage cost analysis
CREATE TABLE IF NOT EXISTS storage_cost_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_date DATE NOT NULL,
    time_range VARCHAR(10) NOT NULL, -- 1d, 7d, 30d
    
    -- Current costs
    current_monthly_cost DECIMAL(10,4),
    hot_tier_cost DECIMAL(10,4),
    warm_tier_cost DECIMAL(10,4),
    cold_tier_cost DECIMAL(10,4),
    
    -- Optimization potential
    potential_monthly_savings DECIMAL(10,4),
    optimization_opportunities INTEGER,
    recommended_migrations INTEGER,
    
    -- Breakdown
    cost_breakdown JSONB,
    recommendations JSONB,
    
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add storage tier column to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS storage_tier VARCHAR(20) DEFAULT 'HOT';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMP WITH TIME ZONE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_storage_migrations_evidence_id ON storage_migrations(evidence_id);
CREATE INDEX IF NOT EXISTS idx_storage_migrations_status ON storage_migrations(status);
CREATE INDEX IF NOT EXISTS idx_storage_migrations_started_at ON storage_migrations(started_at);

CREATE INDEX IF NOT EXISTS idx_storage_events_evidence_id ON storage_events(evidence_id);
CREATE INDEX IF NOT EXISTS idx_storage_events_event_type ON storage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_storage_events_created_at ON storage_events(created_at);

CREATE INDEX IF NOT EXISTS idx_evidence_access_log_evidence_id ON evidence_access_log(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_access_log_user_id ON evidence_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_access_log_accessed_at ON evidence_access_log(accessed_at);
CREATE INDEX IF NOT EXISTS idx_evidence_access_log_access_type ON evidence_access_log(access_type);

CREATE INDEX IF NOT EXISTS idx_evidence_previews_evidence_id ON evidence_previews(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_previews_type ON evidence_previews(preview_type);
CREATE INDEX IF NOT EXISTS idx_evidence_previews_generated_at ON evidence_previews(generated_at);

CREATE INDEX IF NOT EXISTS idx_evidence_streaming_chunks_evidence_id ON evidence_streaming_chunks(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_streaming_chunks_expires_at ON evidence_streaming_chunks(expires_at);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON performance_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_hour ON performance_metrics(metric_date, metric_hour);

CREATE INDEX IF NOT EXISTS idx_storage_cost_analysis_date ON storage_cost_analysis(analysis_date);

CREATE INDEX IF NOT EXISTS idx_evidence_storage_tier ON evidence(storage_tier);
CREATE INDEX IF NOT EXISTS idx_evidence_tier_updated_at ON evidence(tier_updated_at);

-- Row Level Security (RLS)
ALTER TABLE storage_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_tiering_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_streaming_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_cost_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Storage tiers: readable by all authenticated users
CREATE POLICY "Storage tiers readable by all" ON storage_tiers
    FOR SELECT USING (auth.role() = 'authenticated');

-- Storage policies: admins only
CREATE POLICY "Admins can manage storage policies" ON storage_tiering_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'administrator'
        )
    );

-- Storage migrations: same as evidence access
CREATE POLICY "Storage migrations access" ON storage_migrations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM evidence e
            JOIN cases c ON e.case_id = c.id
            WHERE e.id = storage_migrations.evidence_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'evidence_manager')
                )
            )
        )
    );

-- Storage events: same as evidence access
CREATE POLICY "Storage events access" ON storage_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM evidence e
            JOIN cases c ON e.case_id = c.id
            WHERE e.id = storage_events.evidence_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'evidence_manager')
                )
            )
        )
    );

-- Evidence access log: users can see their own, admins can see all
CREATE POLICY "Users can view own access log" ON evidence_access_log
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all access logs" ON evidence_access_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'evidence_manager')
        )
    );

-- Evidence previews: same as evidence access
CREATE POLICY "Evidence previews access" ON evidence_previews
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM evidence e
            JOIN cases c ON e.case_id = c.id
            WHERE e.id = evidence_previews.evidence_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'evidence_manager', 'investigator', 'analyst')
                )
            )
        )
    );

-- Streaming chunks: same as evidence access
CREATE POLICY "Streaming chunks access" ON evidence_streaming_chunks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM evidence e
            JOIN cases c ON e.case_id = c.id
            WHERE e.id = evidence_streaming_chunks.evidence_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('administrator', 'evidence_manager', 'investigator', 'analyst')
                )
            )
        )
    );

-- Performance metrics: admins and evidence managers only
CREATE POLICY "Performance metrics access" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('administrator', 'evidence_manager')
        )
    );

-- Storage cost analysis: admins only
CREATE POLICY "Storage cost analysis access" ON storage_cost_analysis
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'administrator'
        )
    );

-- Functions for performance optimization
CREATE OR REPLACE FUNCTION calculate_storage_costs(
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    tier_name VARCHAR(20),
    total_size_gb DECIMAL(12,4),
    cost_per_gb DECIMAL(6,4),
    total_cost DECIMAL(10,4),
    evidence_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(e.storage_tier, 'HOT') as tier_name,
        ROUND(SUM(COALESCE(e.file_size, 0))::DECIMAL / (1024*1024*1024), 4) as total_size_gb,
        st.cost_per_gb,
        ROUND((SUM(COALESCE(e.file_size, 0))::DECIMAL / (1024*1024*1024)) * st.cost_per_gb, 4) as total_cost,
        COUNT(e.id)::INTEGER as evidence_count
    FROM evidence e
    LEFT JOIN storage_tiers st ON st.tier_name = COALESCE(e.storage_tier, 'HOT')
    WHERE DATE(e.created_at) <= p_date
    GROUP BY COALESCE(e.storage_tier, 'HOT'), st.cost_per_gb
    ORDER BY tier_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_access_performance_stats(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
    storage_tier VARCHAR(20),
    total_accesses INTEGER,
    avg_latency DECIMAL(8,2),
    total_bytes_transferred BIGINT,
    unique_users INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(e.storage_tier, 'HOT') as storage_tier,
        COUNT(eal.id)::INTEGER as total_accesses,
        ROUND(AVG(eal.access_latency), 2) as avg_latency,
        SUM(COALESCE(eal.bytes_transferred, 0)) as total_bytes_transferred,
        COUNT(DISTINCT eal.user_id)::INTEGER as unique_users
    FROM evidence_access_log eal
    JOIN evidence e ON e.id = eal.evidence_id
    WHERE DATE(eal.accessed_at) BETWEEN p_start_date AND p_end_date
    GROUP BY COALESCE(e.storage_tier, 'HOT')
    ORDER BY storage_tier;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_previews_and_chunks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up old previews (older than 7 days and not accessed recently)
    DELETE FROM evidence_previews 
    WHERE generated_at < NOW() - INTERVAL '7 days'
    AND (last_accessed IS NULL OR last_accessed < NOW() - INTERVAL '24 hours');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up expired streaming chunks
    DELETE FROM evidence_streaming_chunks 
    WHERE expires_at < NOW();
    
    -- Clean up old access logs (keep last 90 days)
    DELETE FROM evidence_access_log 
    WHERE accessed_at < NOW() - INTERVAL '90 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic metrics collection
CREATE OR REPLACE FUNCTION update_access_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update preview access count
    IF TG_TABLE_NAME = 'evidence_previews' THEN
        NEW.last_accessed = NOW();
        NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    END IF;
    
    -- Update streaming chunk access count
    IF TG_TABLE_NAME = 'evidence_streaming_chunks' THEN
        NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_preview_access_metrics
    BEFORE UPDATE ON evidence_previews
    FOR EACH ROW
    EXECUTE FUNCTION update_access_metrics();

CREATE TRIGGER update_chunk_access_metrics
    BEFORE UPDATE ON evidence_streaming_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_access_metrics();

-- Insert default storage tiers
INSERT INTO storage_tiers (tier_name, display_name, description, cost_per_gb, access_latency, max_age_days, color) VALUES
('HOT', 'Hot Storage', 'Fast access, recent cases', 0.25, 50, 30, '#ff4757'),
('WARM', 'Warm Storage', 'Moderate access, inactive cases', 0.10, 500, 365, '#ffa502'),
('COLD', 'Cold Storage', 'Archival, long-term retention', 0.02, 5000, NULL, '#3742fa')
ON CONFLICT (tier_name) DO NOTHING;

-- Insert default tiering policies
INSERT INTO storage_tiering_policies (policy_name, description, conditions, target_tier, priority) VALUES
('Active Cases Policy', 'Keep evidence from active cases in hot storage', 
 '{"caseStatus": ["open", "in_progress"], "maxAge": 30}', 'HOT', 100),
('Recent Evidence Policy', 'Keep recently accessed evidence in hot storage', 
 '{"maxAge": 7, "accessFrequency": "high"}', 'HOT', 90),
('Inactive Cases Policy', 'Move evidence from closed cases to warm storage', 
 '{"caseStatus": ["closed"], "minAge": 30, "maxAge": 365}', 'WARM', 50),
('Archived Cases Policy', 'Move evidence from archived cases to cold storage', 
 '{"caseStatus": ["archived"], "minAge": 365}', 'COLD', 10)
ON CONFLICT (policy_name) DO NOTHING;

COMMENT ON TABLE storage_tiers IS 'Configuration for different storage tiers (Hot/Warm/Cold)';
COMMENT ON TABLE storage_tiering_policies IS 'Policies for automatic storage tier assignment';
COMMENT ON TABLE storage_migrations IS 'Tracking of evidence migrations between storage tiers';
COMMENT ON TABLE storage_events IS 'Log of all storage-related events and changes';
COMMENT ON TABLE evidence_access_log IS 'Detailed log of evidence access for performance analysis';
COMMENT ON TABLE evidence_previews IS 'Cached preview images for progressive loading';
COMMENT ON TABLE evidence_streaming_chunks IS 'Cached chunks for streaming large files';
COMMENT ON TABLE performance_metrics IS 'Aggregated performance metrics over time';
COMMENT ON TABLE storage_cost_analysis IS 'Storage cost analysis and optimization recommendations';