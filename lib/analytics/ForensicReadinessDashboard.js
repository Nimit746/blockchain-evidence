/**
 * NIST-Aligned Forensic Readiness Dashboard
 * Compliance metrics and forensic readiness KPIs
 */

class ForensicReadinessDashboard {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.nistFramework = {
            'PR.DS': 'Data Security',
            'PR.AC': 'Access Control', 
            'PR.AT': 'Awareness and Training',
            'PR.IP': 'Information Protection',
            'DE.AE': 'Anomalies and Events',
            'DE.CM': 'Continuous Monitoring',
            'RS.RP': 'Response Planning',
            'RS.CO': 'Communications',
            'RC.RP': 'Recovery Planning',
            'RC.IM': 'Improvements'
        };
        
        this.complianceThresholds = {
            excellent: 95,
            good: 85,
            fair: 70,
            poor: 50
        };
    }

    /**
     * Generate comprehensive forensic readiness report
     */
    async generateReadinessReport(timeRange = '30d') {
        const report = {
            generatedAt: new Date().toISOString(),
            timeRange,
            overallScore: 0,
            overallGrade: 'UNKNOWN',
            categories: {},
            recommendations: [],
            trends: {},
            compliance: {}
        };

        try {
            // Calculate all metrics
            const [
                chainOfCustodyMetrics,
                provenanceMetrics,
                blockchainMetrics,
                retentionMetrics,
                accessControlMetrics,
                auditMetrics,
                incidentResponseMetrics
            ] = await Promise.all([
                this.calculateChainOfCustodyMetrics(timeRange),
                this.calculateProvenanceMetrics(timeRange),
                this.calculateBlockchainMetrics(timeRange),
                this.calculateRetentionMetrics(timeRange),
                this.calculateAccessControlMetrics(timeRange),
                this.calculateAuditMetrics(timeRange),
                this.calculateIncidentResponseMetrics(timeRange)
            ]);

            // Organize by NIST categories
            report.categories = {
                'Data Security (PR.DS)': {
                    score: this.calculateCategoryScore([
                        chainOfCustodyMetrics,
                        provenanceMetrics,
                        blockchainMetrics
                    ]),
                    metrics: {
                        chainOfCustody: chainOfCustodyMetrics,
                        provenance: provenanceMetrics,
                        blockchain: blockchainMetrics
                    }
                },
                'Access Control (PR.AC)': {
                    score: accessControlMetrics.overallScore,
                    metrics: { accessControl: accessControlMetrics }
                },
                'Continuous Monitoring (DE.CM)': {
                    score: auditMetrics.overallScore,
                    metrics: { audit: auditMetrics }
                },
                'Response Planning (RS.RP)': {
                    score: incidentResponseMetrics.overallScore,
                    metrics: { incidentResponse: incidentResponseMetrics }
                },
                'Information Protection (PR.IP)': {
                    score: retentionMetrics.overallScore,
                    metrics: { retention: retentionMetrics }
                }
            };

            // Calculate overall score
            const categoryScores = Object.values(report.categories).map(c => c.score);
            report.overallScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
            report.overallGrade = this.getGrade(report.overallScore);

            // Generate recommendations
            report.recommendations = this.generateRecommendations(report.categories);

            // Calculate trends
            report.trends = await this.calculateTrends(timeRange);

            // NIST compliance mapping
            report.compliance = this.mapToNISTCompliance(report.categories);

            return report;

        } catch (error) {
            console.error('Failed to generate readiness report:', error);
            throw error;
        }
    }

    /**
     * Calculate chain of custody metrics
     */
    async calculateChainOfCustodyMetrics(timeRange) {
        const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));

        try {
            // Get evidence with complete chain of custody
            const { data: evidenceData } = await this.supabase
                .from('evidence')
                .select(`
                    id,
                    created_at,
                    metadata,
                    audit_trail (count)
                `)
                .gte('created_at', startDate.toISOString());

            const totalEvidence = evidenceData?.length || 0;
            let completeChainCount = 0;
            let averageHandoffs = 0;
            let totalHandoffs = 0;

            for (const evidence of evidenceData || []) {
                const auditCount = evidence.audit_trail?.[0]?.count || 0;
                totalHandoffs += auditCount;
                
                // Consider complete if has initial creation + at least one handoff
                if (auditCount >= 2) {
                    completeChainCount++;
                }
            }

            averageHandoffs = totalEvidence > 0 ? totalHandoffs / totalEvidence : 0;
            const completionRate = totalEvidence > 0 ? (completeChainCount / totalEvidence) * 100 : 0;

            return {
                totalEvidence,
                completeChainCount,
                completionRate,
                averageHandoffs,
                score: Math.min(100, completionRate + (averageHandoffs * 5)),
                grade: this.getGrade(completionRate),
                details: {
                    incompleteEvidence: totalEvidence - completeChainCount,
                    averageHandoffsPerEvidence: Math.round(averageHandoffs * 100) / 100
                }
            };

        } catch (error) {
            console.error('Failed to calculate chain of custody metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate provenance metrics
     */
    async calculateProvenanceMetrics(timeRange) {
        const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));

        try {
            const { data: evidenceData } = await this.supabase
                .from('evidence')
                .select(`
                    id,
                    file_type,
                    created_at,
                    c2pa_provenance (id)
                `)
                .gte('created_at', startDate.toISOString());

            const totalEvidence = evidenceData?.length || 0;
            const digitalEvidence = evidenceData?.filter(e => 
                e.file_type?.startsWith('image/') || 
                e.file_type?.startsWith('video/')
            ) || [];
            
            const provenanceCount = evidenceData?.filter(e => 
                e.c2pa_provenance && e.c2pa_provenance.length > 0
            ).length || 0;

            const digitalProvenanceRate = digitalEvidence.length > 0 ? 
                (provenanceCount / digitalEvidence.length) * 100 : 0;

            return {
                totalEvidence,
                digitalEvidence: digitalEvidence.length,
                provenanceCount,
                digitalProvenanceRate,
                score: digitalProvenanceRate,
                grade: this.getGrade(digitalProvenanceRate),
                details: {
                    missingProvenance: digitalEvidence.length - provenanceCount,
                    provenanceTypes: ['C2PA', 'EXIF', 'Custom']
                }
            };

        } catch (error) {
            console.error('Failed to calculate provenance metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate blockchain verification metrics
     */
    async calculateBlockchainMetrics(timeRange) {
        const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));

        try {
            const { data: evidenceData } = await this.supabase
                .from('evidence')
                .select(`
                    id,
                    file_hash,
                    blockchain_hash,
                    created_at
                `)
                .gte('created_at', startDate.toISOString());

            const totalEvidence = evidenceData?.length || 0;
            const blockchainVerified = evidenceData?.filter(e => e.blockchain_hash).length || 0;
            const verificationRate = totalEvidence > 0 ? (blockchainVerified / totalEvidence) * 100 : 0;

            // Mock verification status check
            let verificationFailures = 0;
            for (const evidence of evidenceData || []) {
                if (evidence.blockchain_hash) {
                    // In production, verify against actual blockchain
                    const isValid = Math.random() > 0.05; // 95% success rate
                    if (!isValid) verificationFailures++;
                }
            }

            const integrityRate = blockchainVerified > 0 ? 
                ((blockchainVerified - verificationFailures) / blockchainVerified) * 100 : 0;

            return {
                totalEvidence,
                blockchainVerified,
                verificationRate,
                verificationFailures,
                integrityRate,
                score: (verificationRate + integrityRate) / 2,
                grade: this.getGrade((verificationRate + integrityRate) / 2),
                details: {
                    unverifiedEvidence: totalEvidence - blockchainVerified,
                    lastVerification: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Failed to calculate blockchain metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate retention policy compliance
     */
    async calculateRetentionMetrics(timeRange) {
        try {
            const { data: retentionData } = await this.supabase
                .from('evidence_retention')
                .select(`
                    evidence_id,
                    retention_period,
                    expiry_date,
                    status,
                    evidence (created_at)
                `);

            const totalWithPolicy = retentionData?.length || 0;
            const nearExpiry = retentionData?.filter(r => {
                const expiryDate = new Date(r.expiry_date);
                const warningDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
                return expiryDate <= warningDate;
            }).length || 0;

            const pastDue = retentionData?.filter(r => {
                const expiryDate = new Date(r.expiry_date);
                return expiryDate <= new Date();
            }).length || 0;

            const complianceRate = totalWithPolicy > 0 ? 
                ((totalWithPolicy - pastDue) / totalWithPolicy) * 100 : 0;

            return {
                totalWithPolicy,
                nearExpiry,
                pastDue,
                complianceRate,
                score: complianceRate,
                grade: this.getGrade(complianceRate),
                details: {
                    activeRetentions: totalWithPolicy - pastDue,
                    averageRetentionPeriod: '7 years' // Mock data
                }
            };

        } catch (error) {
            console.error('Failed to calculate retention metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate access control metrics
     */
    async calculateAccessControlMetrics(timeRange) {
        const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));

        try {
            // Get access events
            const { data: accessEvents } = await this.supabase
                .from('security_events')
                .select('*')
                .in('event_type', ['ACCESS_GRANTED', 'ACCESS_DENIED', 'LOGIN_SUCCESS', 'LOGIN_FAILED'])
                .gte('created_at', startDate.toISOString());

            const totalAttempts = accessEvents?.length || 0;
            const deniedAttempts = accessEvents?.filter(e => 
                e.event_type === 'ACCESS_DENIED' || e.event_type === 'LOGIN_FAILED'
            ).length || 0;

            const successRate = totalAttempts > 0 ? 
                ((totalAttempts - deniedAttempts) / totalAttempts) * 100 : 0;

            // Check for policy violations
            const policyViolations = accessEvents?.filter(e => 
                e.policy_result && !e.policy_result.allowed
            ).length || 0;

            const policyComplianceRate = totalAttempts > 0 ? 
                ((totalAttempts - policyViolations) / totalAttempts) * 100 : 0;

            return {
                totalAttempts,
                deniedAttempts,
                successRate,
                policyViolations,
                policyComplianceRate,
                overallScore: (successRate + policyComplianceRate) / 2,
                score: (successRate + policyComplianceRate) / 2,
                grade: this.getGrade((successRate + policyComplianceRate) / 2),
                details: {
                    uniqueUsers: new Set(accessEvents?.map(e => e.user_id)).size,
                    peakAccessHour: '14:00' // Mock data
                }
            };

        } catch (error) {
            console.error('Failed to calculate access control metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate audit metrics
     */
    async calculateAuditMetrics(timeRange) {
        const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));

        try {
            const { data: auditEvents } = await this.supabase
                .from('security_events')
                .select('*')
                .gte('created_at', startDate.toISOString());

            const totalEvents = auditEvents?.length || 0;
            const criticalEvents = auditEvents?.filter(e => e.severity === 'CRITICAL').length || 0;
            const highEvents = auditEvents?.filter(e => e.severity === 'HIGH').length || 0;

            // Calculate audit coverage
            const { data: evidenceCount } = await this.supabase
                .from('evidence')
                .select('id', { count: 'exact' })
                .gte('created_at', startDate.toISOString());

            const auditCoverage = evidenceCount > 0 ? 
                Math.min(100, (totalEvents / evidenceCount) * 10) : 0;

            return {
                totalEvents,
                criticalEvents,
                highEvents,
                auditCoverage,
                overallScore: Math.max(0, auditCoverage - (criticalEvents * 5) - (highEvents * 2)),
                score: Math.max(0, auditCoverage - (criticalEvents * 5) - (highEvents * 2)),
                grade: this.getGrade(Math.max(0, auditCoverage - (criticalEvents * 5) - (highEvents * 2))),
                details: {
                    averageEventsPerDay: Math.round(totalEvents / 30),
                    mostCommonEventType: 'ACCESS_GRANTED' // Mock data
                }
            };

        } catch (error) {
            console.error('Failed to calculate audit metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Calculate incident response metrics
     */
    async calculateIncidentResponseMetrics(timeRange) {
        try {
            // Mock incident response data
            const incidents = [
                { type: 'SECURITY_BREACH', responseTime: 15, resolved: true },
                { type: 'DATA_INTEGRITY', responseTime: 30, resolved: true },
                { type: 'ACCESS_VIOLATION', responseTime: 5, resolved: false }
            ];

            const totalIncidents = incidents.length;
            const resolvedIncidents = incidents.filter(i => i.resolved).length;
            const averageResponseTime = incidents.reduce((sum, i) => sum + i.responseTime, 0) / totalIncidents;
            
            const resolutionRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 100;
            const responseScore = Math.max(0, 100 - averageResponseTime);

            return {
                totalIncidents,
                resolvedIncidents,
                resolutionRate,
                averageResponseTime,
                overallScore: (resolutionRate + responseScore) / 2,
                score: (resolutionRate + responseScore) / 2,
                grade: this.getGrade((resolutionRate + responseScore) / 2),
                details: {
                    openIncidents: totalIncidents - resolvedIncidents,
                    fastestResponse: Math.min(...incidents.map(i => i.responseTime))
                }
            };

        } catch (error) {
            console.error('Failed to calculate incident response metrics:', error);
            return this.getErrorMetrics();
        }
    }

    /**
     * Generate recommendations based on metrics
     */
    generateRecommendations(categories) {
        const recommendations = [];

        for (const [categoryName, category] of Object.entries(categories)) {
            if (category.score < this.complianceThresholds.fair) {
                recommendations.push({
                    category: categoryName,
                    priority: 'HIGH',
                    title: `Improve ${categoryName}`,
                    description: this.getRecommendationText(categoryName, category),
                    impact: 'HIGH',
                    effort: 'MEDIUM'
                });
            } else if (category.score < this.complianceThresholds.good) {
                recommendations.push({
                    category: categoryName,
                    priority: 'MEDIUM',
                    title: `Enhance ${categoryName}`,
                    description: this.getRecommendationText(categoryName, category),
                    impact: 'MEDIUM',
                    effort: 'LOW'
                });
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    getRecommendationText(categoryName, category) {
        const recommendations = {
            'Data Security (PR.DS)': 'Implement comprehensive data protection measures including encryption, access controls, and integrity verification.',
            'Access Control (PR.AC)': 'Strengthen access control policies and implement multi-factor authentication for sensitive operations.',
            'Continuous Monitoring (DE.CM)': 'Enhance monitoring capabilities with real-time alerting and automated threat detection.',
            'Response Planning (RS.RP)': 'Develop and test incident response procedures with regular drills and updates.',
            'Information Protection (PR.IP)': 'Implement robust data retention and disposal policies with automated compliance monitoring.'
        };

        return recommendations[categoryName] || 'Review and improve current practices in this area.';
    }

    /**
     * Calculate trends over time
     */
    async calculateTrends(timeRange) {
        // Mock trend data - in production, calculate actual trends
        return {
            chainOfCustody: {
                trend: 'IMPROVING',
                change: '+5.2%',
                data: [85, 87, 89, 91, 93]
            },
            provenance: {
                trend: 'STABLE',
                change: '+1.1%',
                data: [78, 79, 78, 80, 79]
            },
            blockchain: {
                trend: 'IMPROVING',
                change: '+8.7%',
                data: [82, 85, 88, 90, 89]
            }
        };
    }

    /**
     * Map categories to NIST compliance
     */
    mapToNISTCompliance(categories) {
        const compliance = {};

        for (const [categoryName, category] of Object.entries(categories)) {
            const nistId = this.getNISTId(categoryName);
            compliance[nistId] = {
                name: categoryName,
                score: category.score,
                grade: this.getGrade(category.score),
                compliant: category.score >= this.complianceThresholds.good
            };
        }

        return compliance;
    }

    getNISTId(categoryName) {
        const mapping = {
            'Data Security (PR.DS)': 'PR.DS',
            'Access Control (PR.AC)': 'PR.AC',
            'Continuous Monitoring (DE.CM)': 'DE.CM',
            'Response Planning (RS.RP)': 'RS.RP',
            'Information Protection (PR.IP)': 'PR.IP'
        };

        return mapping[categoryName] || 'UNKNOWN';
    }

    /**
     * Helper methods
     */
    calculateCategoryScore(metrics) {
        const scores = metrics.map(m => m.score || 0);
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    getGrade(score) {
        if (score >= this.complianceThresholds.excellent) return 'A';
        if (score >= this.complianceThresholds.good) return 'B';
        if (score >= this.complianceThresholds.fair) return 'C';
        if (score >= this.complianceThresholds.poor) return 'D';
        return 'F';
    }

    getErrorMetrics() {
        return {
            error: true,
            score: 0,
            grade: 'F',
            details: { error: 'Failed to calculate metrics' }
        };
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

    /**
     * Export readiness report
     */
    async exportReport(report, format = 'JSON') {
        const exportData = {
            ...report,
            exportedAt: new Date().toISOString(),
            format
        };

        switch (format) {
            case 'JSON':
                return {
                    content: JSON.stringify(exportData, null, 2),
                    mimeType: 'application/json',
                    filename: `forensic_readiness_${new Date().toISOString().split('T')[0]}.json`
                };
            case 'CSV':
                return {
                    content: this.generateCSVReport(report),
                    mimeType: 'text/csv',
                    filename: `forensic_readiness_${new Date().toISOString().split('T')[0]}.csv`
                };
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    generateCSVReport(report) {
        const rows = [
            ['Category', 'Score', 'Grade', 'Status'],
            ...Object.entries(report.categories).map(([name, data]) => [
                name,
                Math.round(data.score),
                this.getGrade(data.score),
                data.score >= this.complianceThresholds.good ? 'COMPLIANT' : 'NON-COMPLIANT'
            ])
        ];

        return rows.map(row => row.join(',')).join('\n');
    }
}

module.exports = ForensicReadinessDashboard;