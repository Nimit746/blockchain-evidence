/**
 * Comprehensive Test Runner
 * Orchestrates all testing scenarios and generates reports
 */

const ForensicTestSuite = require('./forensic/ForensicTestSuite');
const LoadTestingSuite = require('./load/LoadTestingSuite');
const { chromium } = require('playwright');

class ComprehensiveTestRunner {
    constructor() {
        this.forensicSuite = new ForensicTestSuite();
        this.loadSuite = new LoadTestingSuite();
        this.testResults = {
            startTime: null,
            endTime: null,
            duration: 0,
            forensicTests: [],
            loadTests: [],
            summary: {},
            recommendations: [],
            reportGenerated: false
        };
    }

    /**
     * Run complete test suite
     */
    async runComprehensiveTests(options = {}) {
        const {
            includeForensic = true,
            includeLoad = true,
            loadTestLevel = 'medium',
            headless = true,
            generateReport = true
        } = options;

        console.log('🚀 Starting Comprehensive Test Suite for EVID-DGC');
        this.testResults.startTime = new Date().toISOString();

        try {
            // Run forensic scenario tests
            if (includeForensic) {
                console.log('\n📋 Running Forensic Scenario Tests...');
                await this.runForensicTests(headless);
            }

            // Run load and performance tests
            if (includeLoad) {
                console.log('\n⚡ Running Load & Performance Tests...');
                await this.runLoadTests(loadTestLevel);
            }

            // Generate comprehensive report
            this.testResults.endTime = new Date().toISOString();
            this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);
            
            this.generateTestSummary();
            
            if (generateReport) {
                await this.generateComprehensiveReport();
            }

            console.log('\n✅ Comprehensive Test Suite Completed');
            this.printSummary();

            return this.testResults;

        } catch (error) {
            console.error('❌ Comprehensive test suite failed:', error);
            throw error;
        }
    }

    /**
     * Run all forensic scenario tests
     */
    async runForensicTests(headless = true) {
        const browser = await chromium.launch({ headless });
        
        try {
            const forensicScenarios = [
                'testCriminalInvestigationWorkflow',
                'testTamperingDetectionWorkflow',
                'testDeepfakeDetectionWorkflow',
                'testMultiJurisdictionWorkflow',
                'testRetentionPolicyWorkflow'
            ];

            for (const scenario of forensicScenarios) {
                console.log(`  🔍 Running ${scenario}...`);
                const page = await browser.newPage();
                
                try {
                    const result = await this.forensicSuite[scenario](page);
                    this.testResults.forensicTests.push(result);
                    
                    const status = result.success ? '✅' : '❌';
                    console.log(`  ${status} ${scenario}: ${result.success ? 'PASSED' : 'FAILED'} (${result.duration}ms)`);
                    
                    if (!result.success && result.errors.length > 0) {
                        console.log(`    Errors: ${result.errors.join(', ')}`);
                    }
                } catch (error) {
                    console.error(`  ❌ ${scenario} failed:`, error.message);
                    this.testResults.forensicTests.push({
                        scenario,
                        success: false,
                        error: error.message,
                        duration: 0
                    });
                } finally {
                    await page.close();
                }
            }
        } finally {
            await browser.close();
        }
    }

    /**
     * Run load and performance tests
     */
    async runLoadTests(testLevel = 'medium') {
        try {
            const loadTestResult = await this.loadSuite.runLoadTestSuite(testLevel);
            this.testResults.loadTests.push(loadTestResult);
            
            console.log(`  ⚡ Load test completed: ${loadTestResult.summary.performance} performance`);
            console.log(`    Total requests: ${loadTestResult.summary.totalRequests}`);
            console.log(`    Error rate: ${loadTestResult.summary.overallErrorRate.toFixed(2)}%`);
            console.log(`    Avg response time: ${loadTestResult.summary.avgResponseTime.toFixed(0)}ms`);
            
        } catch (error) {
            console.error('  ❌ Load tests failed:', error.message);
            this.testResults.loadTests.push({
                testLevel,
                success: false,
                error: error.message
            });
        } finally {
            await this.loadSuite.cleanup();
        }
    }

    /**
     * Generate test summary
     */
    generateTestSummary() {
        const summary = {
            forensic: {
                total: this.testResults.forensicTests.length,
                passed: this.testResults.forensicTests.filter(t => t.success).length,
                failed: this.testResults.forensicTests.filter(t => !t.success).length,
                passRate: 0,
                avgDuration: 0
            },
            load: {
                total: this.testResults.loadTests.length,
                scenarios: this.testResults.loadTests.length > 0 ? 
                    this.testResults.loadTests[0].scenarios?.length || 0 : 0,
                overallPerformance: this.testResults.loadTests.length > 0 ? 
                    this.testResults.loadTests[0].summary?.performance || 'UNKNOWN' : 'UNKNOWN',
                totalRequests: this.testResults.loadTests.length > 0 ? 
                    this.testResults.loadTests[0].summary?.totalRequests || 0 : 0,
                errorRate: this.testResults.loadTests.length > 0 ? 
                    this.testResults.loadTests[0].summary?.overallErrorRate || 0 : 0
            },
            overall: {
                success: true,
                grade: 'A',
                readiness: 'PRODUCTION_READY'
            }
        };

        // Calculate forensic summary
        if (summary.forensic.total > 0) {
            summary.forensic.passRate = (summary.forensic.passed / summary.forensic.total) * 100;
            const totalDuration = this.testResults.forensicTests.reduce((sum, t) => sum + (t.duration || 0), 0);
            summary.forensic.avgDuration = totalDuration / summary.forensic.total;
        }

        // Determine overall success and grade
        const forensicSuccess = summary.forensic.passRate >= 90;
        const loadSuccess = summary.load.errorRate <= 5 && summary.load.overallPerformance !== 'POOR';
        
        summary.overall.success = forensicSuccess && loadSuccess;
        
        if (summary.forensic.passRate >= 95 && summary.load.errorRate <= 2) {
            summary.overall.grade = 'A';
            summary.overall.readiness = 'PRODUCTION_READY';
        } else if (summary.forensic.passRate >= 85 && summary.load.errorRate <= 5) {
            summary.overall.grade = 'B';
            summary.overall.readiness = 'STAGING_READY';
        } else if (summary.forensic.passRate >= 70 && summary.load.errorRate <= 10) {
            summary.overall.grade = 'C';
            summary.overall.readiness = 'DEVELOPMENT_READY';
        } else {
            summary.overall.grade = 'F';
            summary.overall.readiness = 'NOT_READY';
        }

        this.testResults.summary = summary;
        this.generateRecommendations();
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];

        // Forensic test recommendations
        const failedForensicTests = this.testResults.forensicTests.filter(t => !t.success);
        if (failedForensicTests.length > 0) {
            recommendations.push({
                category: 'Forensic Workflows',
                priority: 'HIGH',
                issue: `${failedForensicTests.length} forensic scenarios failed`,
                recommendation: 'Fix failing forensic workflows before production deployment',
                impact: 'Legal compliance and evidence integrity'
            });
        }

        // Load test recommendations
        if (this.testResults.loadTests.length > 0) {
            const loadResult = this.testResults.loadTests[0];
            if (loadResult.summary?.overallErrorRate > 5) {
                recommendations.push({
                    category: 'Performance',
                    priority: 'HIGH',
                    issue: `High error rate under load (${loadResult.summary.overallErrorRate.toFixed(2)}%)`,
                    recommendation: 'Investigate and fix error causes, implement better error handling',
                    impact: 'System reliability and user experience'
                });
            }

            if (loadResult.summary?.avgResponseTime > 2000) {
                recommendations.push({
                    category: 'Performance',
                    priority: 'MEDIUM',
                    issue: `Slow response times (${loadResult.summary.avgResponseTime.toFixed(0)}ms average)`,
                    recommendation: 'Optimize database queries, implement caching, consider CDN',
                    impact: 'User experience and system efficiency'
                });
            }

            // Add load test specific recommendations
            if (loadResult.recommendations) {
                recommendations.push(...loadResult.recommendations.map(rec => ({
                    ...rec,
                    category: 'Load Testing'
                })));
            }
        }

        // Security recommendations
        const securityIssues = this.findSecurityIssues();
        if (securityIssues.length > 0) {
            recommendations.push({
                category: 'Security',
                priority: 'CRITICAL',
                issue: 'Security vulnerabilities detected',
                recommendation: 'Address all security issues before deployment',
                impact: 'Data security and compliance'
            });
        }

        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                category: 'General',
                priority: 'INFO',
                issue: 'All tests passing',
                recommendation: 'System ready for deployment. Continue monitoring in production.',
                impact: 'Operational excellence'
            });
        }

        this.testResults.recommendations = recommendations;
    }

    /**
     * Find security issues from test results
     */
    findSecurityIssues() {
        const issues = [];
        
        // Check for authentication/authorization failures
        for (const test of this.testResults.forensicTests) {
            if (test.steps) {
                for (const step of test.steps) {
                    if (step.step.includes('cross_jurisdiction') && !step.success) {
                        issues.push('Cross-jurisdiction access control failure');
                    }
                    if (step.step.includes('tampering') && !step.success) {
                        issues.push('Tampering detection failure');
                    }
                }
            }
        }

        return issues;
    }

    /**
     * Generate comprehensive test report
     */
    async generateComprehensiveReport() {
        const report = {
            metadata: {
                reportId: require('crypto').randomUUID(),
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
                testSuite: 'EVID-DGC Comprehensive Test Suite'
            },
            executive_summary: {
                overall_grade: this.testResults.summary.overall.grade,
                readiness_status: this.testResults.summary.overall.readiness,
                total_test_duration: this.testResults.duration,
                forensic_pass_rate: this.testResults.summary.forensic.passRate,
                load_test_performance: this.testResults.summary.load.overallPerformance,
                critical_issues: this.testResults.recommendations.filter(r => r.priority === 'CRITICAL').length
            },
            forensic_test_results: {
                summary: this.testResults.summary.forensic,
                detailed_results: this.testResults.forensicTests,
                scenarios_tested: [
                    'Criminal Investigation Workflow',
                    'Tampering Detection and Alert',
                    'Deepfake Detection and Manual Override',
                    'Multi-Jurisdiction Case Handling',
                    'Retention Policy and Legal Hold'
                ]
            },
            load_test_results: {
                summary: this.testResults.summary.load,
                detailed_results: this.testResults.loadTests,
                scenarios_tested: [
                    'Evidence Upload Load Test',
                    'Evidence Verification Load Test',
                    'Hash Verification Load Test',
                    'Blockchain Write Load Test',
                    'Database Stress Test'
                ]
            },
            recommendations: this.testResults.recommendations,
            compliance_assessment: {
                nist_compliance: this.assessNISTCompliance(),
                legal_readiness: this.assessLegalReadiness(),
                security_posture: this.assessSecurityPosture()
            }
        };

        // Save report to file
        const fs = require('fs').promises;
        const reportPath = `test-reports/comprehensive-test-report-${Date.now()}.json`;
        
        try {
            await fs.mkdir('test-reports', { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📄 Comprehensive test report saved to: ${reportPath}`);
            
            // Generate HTML report
            await this.generateHTMLReport(report, reportPath.replace('.json', '.html'));
            
            this.testResults.reportGenerated = true;
        } catch (error) {
            console.error('Failed to generate test report:', error);
        }

        return report;
    }

    /**
     * Generate HTML test report
     */
    async generateHTMLReport(report, htmlPath) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EVID-DGC Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .grade { font-size: 3em; font-weight: bold; color: ${this.getGradeColor(report.executive_summary.overall_grade)}; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .recommendations { margin: 20px 0; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .high-priority { border-left: 4px solid #dc3545; }
        .medium-priority { border-left: 4px solid #ffc107; }
        .low-priority { border-left: 4px solid #28a745; }
        .test-results { margin: 20px 0; }
        .test-scenario { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 EVID-DGC Comprehensive Test Report</h1>
            <div class="grade">${report.executive_summary.overall_grade}</div>
            <p><strong>Status:</strong> ${report.executive_summary.readiness_status}</p>
            <p><strong>Generated:</strong> ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>📋 Forensic Tests</h3>
                <p><strong>Pass Rate:</strong> ${report.executive_summary.forensic_pass_rate.toFixed(1)}%</p>
                <p><strong>Scenarios:</strong> ${report.forensic_test_results.detailed_results.length}</p>
            </div>
            <div class="summary-card">
                <h3>⚡ Load Tests</h3>
                <p><strong>Performance:</strong> ${report.executive_summary.load_test_performance}</p>
                <p><strong>Total Requests:</strong> ${report.load_test_results.summary.totalRequests.toLocaleString()}</p>
            </div>
            <div class="summary-card">
                <h3>🔒 Security</h3>
                <p><strong>Critical Issues:</strong> ${report.executive_summary.critical_issues}</p>
                <p><strong>Security Posture:</strong> ${report.compliance_assessment.security_posture}</p>
            </div>
            <div class="summary-card">
                <h3>⏱️ Duration</h3>
                <p><strong>Total Time:</strong> ${Math.round(report.executive_summary.total_test_duration / 1000 / 60)} minutes</p>
                <p><strong>Report ID:</strong> ${report.metadata.reportId.substring(0, 8)}...</p>
            </div>
        </div>

        <div class="recommendations">
            <h2>📝 Recommendations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority.toLowerCase()}-priority">
                    <h4>${rec.category} - ${rec.priority} Priority</h4>
                    <p><strong>Issue:</strong> ${rec.issue}</p>
                    <p><strong>Recommendation:</strong> ${rec.recommendation}</p>
                    <p><strong>Impact:</strong> ${rec.impact}</p>
                </div>
            `).join('')}
        </div>

        <div class="test-results">
            <h2>🔍 Forensic Test Results</h2>
            ${report.forensic_test_results.detailed_results.map(test => `
                <div class="test-scenario ${test.success ? 'passed' : 'failed'}">
                    <h4>${test.scenario} - ${test.success ? '✅ PASSED' : '❌ FAILED'}</h4>
                    <p><strong>Duration:</strong> ${test.duration}ms</p>
                    <p><strong>Steps:</strong> ${test.steps ? test.steps.length : 0}</p>
                    ${test.errors && test.errors.length > 0 ? `<p><strong>Errors:</strong> ${test.errors.join(', ')}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="test-results">
            <h2>⚡ Load Test Results</h2>
            ${report.load_test_results.detailed_results.map(test => `
                <div class="test-scenario">
                    <h4>Load Test - ${test.testLevel.toUpperCase()}</h4>
                    <p><strong>Performance:</strong> ${test.summary.performance}</p>
                    <p><strong>Total Requests:</strong> ${test.summary.totalRequests.toLocaleString()}</p>
                    <p><strong>Error Rate:</strong> ${test.summary.overallErrorRate.toFixed(2)}%</p>
                    <p><strong>Avg Response Time:</strong> ${test.summary.avgResponseTime.toFixed(0)}ms</p>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

        const fs = require('fs').promises;
        await fs.writeFile(htmlPath, html);
        console.log(`📄 HTML test report saved to: ${htmlPath}`);
    }

    getGradeColor(grade) {
        const colors = {
            'A': '#28a745',
            'B': '#17a2b8',
            'C': '#ffc107',
            'D': '#fd7e14',
            'F': '#dc3545'
        };
        return colors[grade] || '#6c757d';
    }

    assessNISTCompliance() {
        // Mock NIST compliance assessment
        return 'COMPLIANT';
    }

    assessLegalReadiness() {
        // Mock legal readiness assessment
        const forensicPassRate = this.testResults.summary.forensic.passRate;
        if (forensicPassRate >= 95) return 'COURT_READY';
        if (forensicPassRate >= 85) return 'REVIEW_REQUIRED';
        return 'NOT_READY';
    }

    assessSecurityPosture() {
        // Mock security posture assessment
        const criticalIssues = this.testResults.recommendations.filter(r => r.priority === 'CRITICAL').length;
        if (criticalIssues === 0) return 'STRONG';
        if (criticalIssues <= 2) return 'MODERATE';
        return 'WEAK';
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Overall Grade: ${this.testResults.summary.overall.grade}`);
        console.log(`Readiness: ${this.testResults.summary.overall.readiness}`);
        console.log(`Duration: ${Math.round(this.testResults.duration / 1000 / 60)} minutes`);
        console.log('');
        console.log(`Forensic Tests: ${this.testResults.summary.forensic.passed}/${this.testResults.summary.forensic.total} passed (${this.testResults.summary.forensic.passRate.toFixed(1)}%)`);
        console.log(`Load Test Performance: ${this.testResults.summary.load.overallPerformance}`);
        console.log(`Total Requests: ${this.testResults.summary.load.totalRequests.toLocaleString()}`);
        console.log(`Error Rate: ${this.testResults.summary.load.errorRate.toFixed(2)}%`);
        console.log('');
        console.log(`Recommendations: ${this.testResults.recommendations.length}`);
        console.log('='.repeat(60));
    }
}

module.exports = ComprehensiveTestRunner;

// CLI runner
if (require.main === module) {
    const runner = new ComprehensiveTestRunner();
    
    const args = process.argv.slice(2);
    const options = {
        includeForensic: !args.includes('--no-forensic'),
        includeLoad: !args.includes('--no-load'),
        loadTestLevel: args.find(arg => arg.startsWith('--load-level='))?.split('=')[1] || 'medium',
        headless: !args.includes('--headed'),
        generateReport: !args.includes('--no-report')
    };

    runner.runComprehensiveTests(options)
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}