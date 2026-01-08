/**
 * Evidence Storage Tiering System
 * Hot/Warm/Cold storage with cost and latency optimization
 */

const crypto = require('crypto');

class StorageTieringManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.tiers = {
            HOT: {
                name: 'Hot Storage',
                description: 'Fast access, recent cases',
                costPerGB: 0.25, // USD per GB per month
                accessLatency: 50, // milliseconds
                maxAge: 30, // days
                color: '#ff4757'
            },
            WARM: {
                name: 'Warm Storage',
                description: 'Moderate access, inactive cases',
                costPerGB: 0.10,
                accessLatency: 500,
                maxAge: 365,
                color: '#ffa502'
            },
            COLD: {
                name: 'Cold Storage',
                description: 'Archival, long-term retention',
                costPerGB: 0.02,
                accessLatency: 5000,
                maxAge: null, // indefinite
                color: '#3742fa'
            }
        };
        
        this.policies = new Map();
        this.migrationQueue = [];
        this.costCache = new Map();
    }

    /**
     * Initialize storage tiering policies
     */
    async initializePolicies() {
        const defaultPolicies = [
            {
                id: 'active_cases',
                name: 'Active Cases Policy',
                conditions: {
                    caseStatus: ['open', 'in_progress'],
                    maxAge: 30
                },
                targetTier: 'HOT',
                priority: 100
            },
            {
                id: 'recent_evidence',
                name: 'Recent Evidence Policy',
                conditions: {
                    maxAge: 7,
                    accessFrequency: 'high'
                },
                targetTier: 'HOT',
                priority: 90
            },
            {
                id: 'inactive_cases',
                name: 'Inactive Cases Policy',
                conditions: {
                    caseStatus: ['closed'],
                    minAge: 30,
                    maxAge: 365
                },
                targetTier: 'WARM',
                priority: 50
            },
            {
                id: 'archived_cases',
                name: 'Archived Cases Policy',
                conditions: {
                    caseStatus: ['archived'],
                    minAge: 365
                },
                targetTier: 'COLD',
                priority: 10
            }
        ];

        for (const policy of defaultPolicies) {
            this.policies.set(policy.id, policy);
        }
    }

    /**
     * Analyze evidence and recommend storage tier
     */
    async analyzeEvidenceStorage(evidenceId) {
        try {
            const { data: evidence } = await this.supabase
                .from('evidence')
                .select(`
                    *,
                    cases (
                        id,
                        status,
                        priority,
                        created_at,
                        updated_at
                    ),
                    evidence_access_log (
                        count,
                        last_accessed:MAX(accessed_at)
                    )
                `)
                .eq('id', evidenceId)
                .single();

            if (!evidence) {
                throw new Error('Evidence not found');
            }

            const analysis = {
                evidenceId,
                currentTier: evidence.storage_tier || 'HOT',
                recommendedTier: null,
                reasons: [],
                costImpact: null,
                latencyImpact: null,
                metadata: {
                    fileSize: evidence.file_size || 0,
                    age: this.calculateAge(evidence.created_at),
                    caseStatus: evidence.cases?.status,
                    casePriority: evidence.cases?.priority,
                    accessFrequency: this.calculateAccessFrequency(evidence.evidence_access_log),
                    lastAccessed: evidence.evidence_access_log?.[0]?.last_accessed
                }
            };

            // Apply policies to determine recommended tier
            const applicablePolicies = this.findApplicablePolicies(analysis.metadata);
            const recommendedTier = this.selectBestTier(applicablePolicies);

            analysis.recommendedTier = recommendedTier;
            analysis.reasons = this.generateReasons(analysis.metadata, applicablePolicies);

            // Calculate cost and latency impact
            if (analysis.currentTier !== analysis.recommendedTier) {
                analysis.costImpact = this.calculateCostImpact(
                    analysis.metadata.fileSize,
                    analysis.currentTier,
                    analysis.recommendedTier
                );
                analysis.latencyImpact = this.calculateLatencyImpact(
                    analysis.currentTier,
                    analysis.recommendedTier
                );
            }

            return analysis;

        } catch (error) {
            console.error('Failed to analyze evidence storage:', error);
            throw error;
        }
    }

    /**
     * Migrate evidence to different storage tier
     */
    async migrateEvidence(evidenceId, targetTier, reason = 'Manual migration') {
        try {
            const analysis = await this.analyzeEvidenceStorage(evidenceId);
            
            if (analysis.currentTier === targetTier) {
                return { success: true, message: 'Evidence already in target tier' };
            }

            // Create migration record
            const migration = {
                id: crypto.randomUUID(),
                evidence_id: evidenceId,
                from_tier: analysis.currentTier,
                to_tier: targetTier,
                reason,
                file_size: analysis.metadata.fileSize,
                estimated_cost_change: this.calculateCostImpact(
                    analysis.metadata.fileSize,
                    analysis.currentTier,
                    targetTier
                ).monthlyChange,
                status: 'PENDING',
                created_at: new Date().toISOString()
            };

            // Insert migration record
            const { error: migrationError } = await this.supabase
                .from('storage_migrations')
                .insert([migration]);

            if (migrationError) throw migrationError;

            // Update evidence storage tier
            const { error: updateError } = await this.supabase
                .from('evidence')
                .update({
                    storage_tier: targetTier,
                    tier_updated_at: new Date().toISOString()
                })
                .eq('id', evidenceId);

            if (updateError) throw updateError;

            // Update migration status
            await this.supabase
                .from('storage_migrations')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString()
                })
                .eq('id', migration.id);

            // Log the migration
            await this.logStorageEvent({
                eventType: 'TIER_MIGRATION',
                evidenceId,
                fromTier: analysis.currentTier,
                toTier: targetTier,
                reason,
                fileSize: analysis.metadata.fileSize
            });

            return {
                success: true,
                migration,
                costImpact: this.calculateCostImpact(
                    analysis.metadata.fileSize,
                    analysis.currentTier,
                    targetTier
                )
            };

        } catch (error) {
            console.error('Failed to migrate evidence:', error);
            throw error;
        }
    }

    /**
     * Run automated tiering based on policies
     */
    async runAutomatedTiering(dryRun = false) {
        try {
            const { data: evidence } = await this.supabase
                .from('evidence')
                .select(`
                    *,
                    cases (status, priority, created_at, updated_at),
                    evidence_access_log (count, MAX(accessed_at) as last_accessed)
                `);

            const migrations = [];
            let totalCostSavings = 0;

            for (const item of evidence || []) {
                const analysis = await this.analyzeEvidenceStorage(item.id);
                
                if (analysis.currentTier !== analysis.recommendedTier) {
                    const migration = {
                        evidenceId: item.id,
                        filename: item.filename,
                        currentTier: analysis.currentTier,
                        recommendedTier: analysis.recommendedTier,
                        reasons: analysis.reasons,
                        costImpact: analysis.costImpact,
                        fileSize: analysis.metadata.fileSize
                    };

                    migrations.push(migration);
                    
                    if (analysis.costImpact) {
                        totalCostSavings += analysis.costImpact.monthlyChange;
                    }

                    // Execute migration if not dry run
                    if (!dryRun) {
                        await this.migrateEvidence(
                            item.id,
                            analysis.recommendedTier,
                            'Automated policy-based migration'
                        );
                    }
                }
            }

            return {
                totalEvidence: evidence?.length || 0,
                migrationsNeeded: migrations.length,
                migrations,
                estimatedMonthlySavings: Math.abs(totalCostSavings),
                dryRun
            };

        } catch (error) {
            console.error('Failed to run automated tiering:', error);
            throw error;
        }
    }

    /**
     * Calculate storage costs by tier
     */
    async calculateStorageCosts(timeRange = '30d') {
        try {
            const { data: evidence } = await this.supabase
                .from('evidence')
                .select('storage_tier, file_size')
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString());

            const costs = {
                HOT: { size: 0, cost: 0, count: 0 },
                WARM: { size: 0, cost: 0, count: 0 },
                COLD: { size: 0, cost: 0, count: 0 }
            };

            for (const item of evidence || []) {
                const tier = item.storage_tier || 'HOT';
                const sizeGB = (item.file_size || 0) / (1024 * 1024 * 1024);
                
                costs[tier].size += sizeGB;
                costs[tier].cost += sizeGB * this.tiers[tier].costPerGB;
                costs[tier].count += 1;
            }

            const totalCost = Object.values(costs).reduce((sum, tier) => sum + tier.cost, 0);
            const totalSize = Object.values(costs).reduce((sum, tier) => sum + tier.size, 0);

            return {
                timeRange,
                totalCost: Math.round(totalCost * 100) / 100,
                totalSize: Math.round(totalSize * 100) / 100,
                averageCostPerGB: totalSize > 0 ? totalCost / totalSize : 0,
                breakdown: costs,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to calculate storage costs:', error);
            throw error;
        }
    }

    /**
     * Get storage performance metrics
     */
    async getPerformanceMetrics(timeRange = '7d') {
        try {
            const { data: accessLogs } = await this.supabase
                .from('evidence_access_log')
                .select(`
                    *,
                    evidence (storage_tier, file_size)
                `)
                .gte('accessed_at', new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString());

            const metrics = {
                HOT: { accesses: 0, totalLatency: 0, avgLatency: 0 },
                WARM: { accesses: 0, totalLatency: 0, avgLatency: 0 },
                COLD: { accesses: 0, totalLatency: 0, avgLatency: 0 }
            };

            for (const log of accessLogs || []) {
                const tier = log.evidence?.storage_tier || 'HOT';
                const latency = log.access_latency || this.tiers[tier].accessLatency;
                
                metrics[tier].accesses += 1;
                metrics[tier].totalLatency += latency;
            }

            // Calculate averages
            for (const tier of Object.keys(metrics)) {
                if (metrics[tier].accesses > 0) {
                    metrics[tier].avgLatency = metrics[tier].totalLatency / metrics[tier].accesses;
                }
            }

            return {
                timeRange,
                metrics,
                totalAccesses: Object.values(metrics).reduce((sum, m) => sum + m.accesses, 0),
                overallAvgLatency: this.calculateOverallAverage(metrics),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to get performance metrics:', error);
            throw error;
        }
    }

    /**
     * Generate storage optimization recommendations
     */
    async generateOptimizationRecommendations() {
        try {
            const costs = await this.calculateStorageCosts('30d');
            const performance = await this.getPerformanceMetrics('7d');
            const tiering = await this.runAutomatedTiering(true); // Dry run

            const recommendations = [];

            // Cost optimization recommendations
            if (tiering.estimatedMonthlySavings > 10) {
                recommendations.push({
                    type: 'COST_OPTIMIZATION',
                    priority: 'HIGH',
                    title: 'Automated Tiering Can Reduce Costs',
                    description: `Implementing automated tiering could save $${tiering.estimatedMonthlySavings.toFixed(2)} per month`,
                    impact: tiering.estimatedMonthlySavings,
                    action: 'Enable automated tiering policies'
                });
            }

            // Performance recommendations
            if (performance.metrics.HOT.avgLatency > 100) {
                recommendations.push({
                    type: 'PERFORMANCE',
                    priority: 'MEDIUM',
                    title: 'Hot Storage Latency High',
                    description: 'Hot storage showing higher than expected latency',
                    impact: performance.metrics.HOT.avgLatency,
                    action: 'Review hot storage infrastructure'
                });
            }

            // Capacity recommendations
            const hotStorageRatio = costs.breakdown.HOT.size / costs.totalSize;
            if (hotStorageRatio > 0.7) {
                recommendations.push({
                    type: 'CAPACITY',
                    priority: 'MEDIUM',
                    title: 'Too Much Hot Storage',
                    description: 'Over 70% of data in expensive hot storage',
                    impact: hotStorageRatio,
                    action: 'Review and migrate older evidence to warm/cold storage'
                });
            }

            return {
                recommendations,
                summary: {
                    totalRecommendations: recommendations.length,
                    potentialSavings: tiering.estimatedMonthlySavings,
                    currentCosts: costs.totalCost,
                    optimizationOpportunity: recommendations.length > 0
                },
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to generate optimization recommendations:', error);
            throw error;
        }
    }

    // Helper methods
    calculateAge(createdAt) {
        return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    }

    calculateAccessFrequency(accessLog) {
        const count = accessLog?.[0]?.count || 0;
        if (count > 10) return 'high';
        if (count > 3) return 'medium';
        return 'low';
    }

    findApplicablePolicies(metadata) {
        const applicable = [];
        
        for (const policy of this.policies.values()) {
            if (this.policyMatches(policy, metadata)) {
                applicable.push(policy);
            }
        }
        
        return applicable.sort((a, b) => b.priority - a.priority);
    }

    policyMatches(policy, metadata) {
        const conditions = policy.conditions;
        
        // Check case status
        if (conditions.caseStatus && !conditions.caseStatus.includes(metadata.caseStatus)) {
            return false;
        }
        
        // Check age constraints
        if (conditions.maxAge && metadata.age > conditions.maxAge) {
            return false;
        }
        
        if (conditions.minAge && metadata.age < conditions.minAge) {
            return false;
        }
        
        // Check access frequency
        if (conditions.accessFrequency && metadata.accessFrequency !== conditions.accessFrequency) {
            return false;
        }
        
        return true;
    }

    selectBestTier(policies) {
        if (policies.length === 0) return 'WARM'; // Default
        return policies[0].targetTier; // Highest priority policy
    }

    generateReasons(metadata, policies) {
        const reasons = [];
        
        if (policies.length > 0) {
            const topPolicy = policies[0];
            reasons.push(`Matches policy: ${topPolicy.name}`);
        }
        
        if (metadata.age > 365) {
            reasons.push('Evidence is over 1 year old');
        } else if (metadata.age > 30) {
            reasons.push('Evidence is over 30 days old');
        }
        
        if (metadata.caseStatus === 'archived') {
            reasons.push('Case is archived');
        } else if (metadata.caseStatus === 'closed') {
            reasons.push('Case is closed');
        }
        
        if (metadata.accessFrequency === 'low') {
            reasons.push('Low access frequency');
        }
        
        return reasons;
    }

    calculateCostImpact(fileSizeBytes, fromTier, toTier) {
        const sizeGB = fileSizeBytes / (1024 * 1024 * 1024);
        const fromCost = sizeGB * this.tiers[fromTier].costPerGB;
        const toCost = sizeGB * this.tiers[toTier].costPerGB;
        const monthlyChange = toCost - fromCost;
        
        return {
            fromCost: Math.round(fromCost * 100) / 100,
            toCost: Math.round(toCost * 100) / 100,
            monthlyChange: Math.round(monthlyChange * 100) / 100,
            annualChange: Math.round(monthlyChange * 12 * 100) / 100,
            percentChange: fromCost > 0 ? Math.round((monthlyChange / fromCost) * 100) : 0
        };
    }

    calculateLatencyImpact(fromTier, toTier) {
        const fromLatency = this.tiers[fromTier].accessLatency;
        const toLatency = this.tiers[toTier].accessLatency;
        const change = toLatency - fromLatency;
        
        return {
            fromLatency,
            toLatency,
            change,
            percentChange: fromLatency > 0 ? Math.round((change / fromLatency) * 100) : 0
        };
    }

    calculateOverallAverage(metrics) {
        let totalLatency = 0;
        let totalAccesses = 0;
        
        for (const tier of Object.values(metrics)) {
            totalLatency += tier.totalLatency;
            totalAccesses += tier.accesses;
        }
        
        return totalAccesses > 0 ? totalLatency / totalAccesses : 0;
    }

    parseTimeRange(timeRange) {
        const units = {
            'd': 24 * 60 * 60 * 1000,
            'h': 60 * 60 * 1000,
            'm': 60 * 1000
        };

        const match = timeRange.match(/^(\d+)([dhm])$/);
        if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days

        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }

    async logStorageEvent(eventData) {
        try {
            await this.supabase
                .from('storage_events')
                .insert([{
                    event_type: eventData.eventType,
                    evidence_id: eventData.evidenceId,
                    from_tier: eventData.fromTier,
                    to_tier: eventData.toTier,
                    reason: eventData.reason,
                    file_size: eventData.fileSize,
                    created_at: new Date().toISOString()
                }]);
        } catch (error) {
            console.error('Failed to log storage event:', error);
        }
    }

    /**
     * Get storage dashboard data
     */
    async getStorageDashboard() {
        try {
            const [costs, performance, recommendations] = await Promise.all([
                this.calculateStorageCosts('30d'),
                this.getPerformanceMetrics('7d'),
                this.generateOptimizationRecommendations()
            ]);

            return {
                costs,
                performance,
                recommendations,
                tiers: this.tiers,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to get storage dashboard:', error);
            throw error;
        }
    }
}

module.exports = StorageTieringManager;