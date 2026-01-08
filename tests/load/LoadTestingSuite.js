/**
 * Load & Stress Testing Suite
 * Performance testing for evidence upload and verification paths
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

class LoadTestingSuite {
    constructor() {
        this.testConfigs = {
            light: {
                users: 5,
                duration: 60000, // 1 minute
                rampUp: 10000,   // 10 seconds
                evidenceSize: 1024 * 1024 // 1MB
            },
            medium: {
                users: 20,
                duration: 300000, // 5 minutes
                rampUp: 30000,    // 30 seconds
                evidenceSize: 5 * 1024 * 1024 // 5MB
            },
            heavy: {
                users: 50,
                duration: 600000, // 10 minutes
                rampUp: 60000,    // 1 minute
                evidenceSize: 10 * 1024 * 1024 // 10MB
            },
            stress: {
                users: 100,
                duration: 900000, // 15 minutes
                rampUp: 120000,   // 2 minutes
                evidenceSize: 20 * 1024 * 1024 // 20MB
            }
        };
        
        this.metrics = {
            requests: 0,
            responses: 0,
            errors: 0,
            timeouts: 0,
            responseTimes: [],
            throughput: 0,
            errorRate: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0
        };
        
        this.workers = [];
        this.results = [];
    }

    /**
     * Run comprehensive load test suite
     */
    async runLoadTestSuite(testLevel = 'medium') {
        const config = this.testConfigs[testLevel];
        const testResults = {
            testLevel,
            config,
            startTime: new Date().toISOString(),
            scenarios: [],
            summary: {},
            recommendations: []
        };

        console.log(`Starting ${testLevel} load test with ${config.users} users...`);

        try {
            // Test Scenario 1: Evidence Upload Load Test
            const uploadResults = await this.runEvidenceUploadLoadTest(config);
            testResults.scenarios.push(uploadResults);

            // Test Scenario 2: Evidence Verification Load Test
            const verificationResults = await this.runEvidenceVerificationLoadTest(config);
            testResults.scenarios.push(verificationResults);

            // Test Scenario 3: Concurrent Hash Verification
            const hashResults = await this.runHashVerificationLoadTest(config);
            testResults.scenarios.push(hashResults);

            // Test Scenario 4: Blockchain Write Load Test
            const blockchainResults = await this.runBlockchainWriteLoadTest(config);
            testResults.scenarios.push(blockchainResults);

            // Test Scenario 5: Database Stress Test
            const databaseResults = await this.runDatabaseStressTest(config);
            testResults.scenarios.push(databaseResults);

            // Generate summary and recommendations
            testResults.summary = this.generateTestSummary(testResults.scenarios);
            testResults.recommendations = this.generateRecommendations(testResults.summary);
            testResults.endTime = new Date().toISOString();
            testResults.totalDuration = new Date(testResults.endTime) - new Date(testResults.startTime);

            return testResults;

        } catch (error) {
            console.error('Load test suite failed:', error);
            throw error;
        }
    }

    /**
     * Evidence Upload Load Test
     */
    async runEvidenceUploadLoadTest(config) {
        const testResults = {
            scenario: 'evidence_upload',
            config,
            metrics: this.initializeMetrics(),
            startTime: Date.now(),
            workers: []
        };

        console.log('Running evidence upload load test...');

        try {
            // Create worker threads for concurrent uploads
            const workerPromises = [];
            
            for (let i = 0; i < config.users; i++) {
                const workerPromise = this.createUploadWorker(i, config);
                workerPromises.push(workerPromise);
                
                // Ramp up gradually
                if (i < config.users - 1) {
                    await this.sleep(config.rampUp / config.users);
                }
            }

            // Wait for all workers to complete
            const workerResults = await Promise.all(workerPromises);
            testResults.workers = workerResults;

            // Aggregate metrics
            testResults.metrics = this.aggregateWorkerMetrics(workerResults);
            testResults.endTime = Date.now();
            testResults.duration = testResults.endTime - testResults.startTime;

            console.log(`Upload test completed: ${testResults.metrics.totalRequests} requests, ${testResults.metrics.errorRate}% error rate`);

        } catch (error) {
            console.error('Evidence upload load test failed:', error);
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * Evidence Verification Load Test
     */
    async runEvidenceVerificationLoadTest(config) {
        const testResults = {
            scenario: 'evidence_verification',
            config,
            metrics: this.initializeMetrics(),
            startTime: Date.now()
        };

        console.log('Running evidence verification load test...');

        try {
            // Pre-create evidence items for verification
            const evidenceIds = await this.createTestEvidence(config.users * 2);
            
            // Create verification workers
            const workerPromises = [];
            
            for (let i = 0; i < config.users; i++) {
                const workerPromise = this.createVerificationWorker(i, config, evidenceIds);
                workerPromises.push(workerPromise);
                
                await this.sleep(config.rampUp / config.users);
            }

            const workerResults = await Promise.all(workerPromises);
            testResults.metrics = this.aggregateWorkerMetrics(workerResults);
            testResults.endTime = Date.now();
            testResults.duration = testResults.endTime - testResults.startTime;

            console.log(`Verification test completed: ${testResults.metrics.totalRequests} verifications`);

        } catch (error) {
            console.error('Evidence verification load test failed:', error);
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * Hash Verification Load Test
     */
    async runHashVerificationLoadTest(config) {
        const testResults = {
            scenario: 'hash_verification',
            config,
            metrics: this.initializeMetrics(),
            startTime: Date.now()
        };

        console.log('Running hash verification load test...');

        try {
            const workerPromises = [];
            
            for (let i = 0; i < config.users; i++) {
                const workerPromise = this.createHashVerificationWorker(i, config);
                workerPromises.push(workerPromise);
                
                await this.sleep(config.rampUp / config.users);
            }

            const workerResults = await Promise.all(workerPromises);
            testResults.metrics = this.aggregateWorkerMetrics(workerResults);
            testResults.endTime = Date.now();
            testResults.duration = testResults.endTime - testResults.startTime;

            console.log(`Hash verification test completed: ${testResults.metrics.totalRequests} hash operations`);

        } catch (error) {
            console.error('Hash verification load test failed:', error);
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * Blockchain Write Load Test
     */
    async runBlockchainWriteLoadTest(config) {
        const testResults = {
            scenario: 'blockchain_write',
            config,
            metrics: this.initializeMetrics(),
            startTime: Date.now()
        };

        console.log('Running blockchain write load test...');

        try {
            const workerPromises = [];
            
            for (let i = 0; i < Math.min(config.users, 20); i++) { // Limit blockchain workers
                const workerPromise = this.createBlockchainWorker(i, config);
                workerPromises.push(workerPromise);
                
                await this.sleep(config.rampUp / Math.min(config.users, 20));
            }

            const workerResults = await Promise.all(workerPromises);
            testResults.metrics = this.aggregateWorkerMetrics(workerResults);
            testResults.endTime = Date.now();
            testResults.duration = testResults.endTime - testResults.startTime;

            console.log(`Blockchain test completed: ${testResults.metrics.totalRequests} blockchain writes`);

        } catch (error) {
            console.error('Blockchain write load test failed:', error);
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * Database Stress Test
     */
    async runDatabaseStressTest(config) {
        const testResults = {
            scenario: 'database_stress',
            config,
            metrics: this.initializeMetrics(),
            startTime: Date.now()
        };

        console.log('Running database stress test...');

        try {
            const workerPromises = [];
            
            for (let i = 0; i < config.users; i++) {
                const workerPromise = this.createDatabaseWorker(i, config);
                workerPromises.push(workerPromise);
                
                await this.sleep(config.rampUp / config.users);
            }

            const workerResults = await Promise.all(workerPromises);
            testResults.metrics = this.aggregateWorkerMetrics(workerResults);
            testResults.endTime = Date.now();
            testResults.duration = testResults.endTime - testResults.startTime;

            console.log(`Database test completed: ${testResults.metrics.totalRequests} database operations`);

        } catch (error) {
            console.error('Database stress test failed:', error);
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * Create upload worker thread
     */
    async createUploadWorker(workerId, config) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    type: 'upload',
                    workerId,
                    config,
                    duration: config.duration
                }
            });

            worker.on('message', (result) => {
                resolve(result);
            });

            worker.on('error', (error) => {
                reject(error);
            });

            this.workers.push(worker);
        });
    }

    /**
     * Create verification worker thread
     */
    async createVerificationWorker(workerId, config, evidenceIds) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    type: 'verification',
                    workerId,
                    config,
                    evidenceIds,
                    duration: config.duration
                }
            });

            worker.on('message', (result) => {
                resolve(result);
            });

            worker.on('error', (error) => {
                reject(error);
            });

            this.workers.push(worker);
        });
    }

    /**
     * Create hash verification worker
     */
    async createHashVerificationWorker(workerId, config) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    type: 'hash_verification',
                    workerId,
                    config,
                    duration: config.duration
                }
            });

            worker.on('message', (result) => {
                resolve(result);
            });

            worker.on('error', (error) => {
                reject(error);
            });

            this.workers.push(worker);
        });
    }

    /**
     * Create blockchain worker
     */
    async createBlockchainWorker(workerId, config) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    type: 'blockchain',
                    workerId,
                    config,
                    duration: config.duration
                }
            });

            worker.on('message', (result) => {
                resolve(result);
            });

            worker.on('error', (error) => {
                reject(error);
            });

            this.workers.push(worker);
        });
    }

    /**
     * Create database worker
     */
    async createDatabaseWorker(workerId, config) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    type: 'database',
                    workerId,
                    config,
                    duration: config.duration
                }
            });

            worker.on('message', (result) => {
                resolve(result);
            });

            worker.on('error', (error) => {
                reject(error);
            });

            this.workers.push(worker);
        });
    }

    /**
     * Initialize metrics object
     */
    initializeMetrics() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeouts: 0,
            responseTimes: [],
            throughput: 0,
            errorRate: 0,
            avgResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            p50ResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0
        };
    }

    /**
     * Aggregate metrics from worker results
     */
    aggregateWorkerMetrics(workerResults) {
        const aggregated = this.initializeMetrics();
        const allResponseTimes = [];

        for (const result of workerResults) {
            aggregated.totalRequests += result.totalRequests;
            aggregated.successfulRequests += result.successfulRequests;
            aggregated.failedRequests += result.failedRequests;
            aggregated.timeouts += result.timeouts;
            allResponseTimes.push(...result.responseTimes);
        }

        // Calculate aggregated metrics
        aggregated.responseTimes = allResponseTimes;
        aggregated.errorRate = aggregated.totalRequests > 0 ? 
            (aggregated.failedRequests / aggregated.totalRequests) * 100 : 0;
        
        if (allResponseTimes.length > 0) {
            allResponseTimes.sort((a, b) => a - b);
            aggregated.avgResponseTime = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
            aggregated.minResponseTime = allResponseTimes[0];
            aggregated.maxResponseTime = allResponseTimes[allResponseTimes.length - 1];
            aggregated.p50ResponseTime = this.getPercentile(allResponseTimes, 50);
            aggregated.p95ResponseTime = this.getPercentile(allResponseTimes, 95);
            aggregated.p99ResponseTime = this.getPercentile(allResponseTimes, 99);
        }

        return aggregated;
    }

    /**
     * Calculate percentile from sorted array
     */
    getPercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    /**
     * Generate test summary
     */
    generateTestSummary(scenarios) {
        const summary = {
            totalScenarios: scenarios.length,
            overallSuccess: true,
            totalRequests: 0,
            totalErrors: 0,
            avgResponseTime: 0,
            maxErrorRate: 0,
            bottlenecks: [],
            performance: 'GOOD'
        };

        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const scenario of scenarios) {
            if (scenario.error) {
                summary.overallSuccess = false;
            }

            if (scenario.metrics) {
                summary.totalRequests += scenario.metrics.totalRequests;
                summary.totalErrors += scenario.metrics.failedRequests;
                summary.maxErrorRate = Math.max(summary.maxErrorRate, scenario.metrics.errorRate);

                if (scenario.metrics.responseTimes.length > 0) {
                    totalResponseTime += scenario.metrics.avgResponseTime * scenario.metrics.responseTimes.length;
                    responseTimeCount += scenario.metrics.responseTimes.length;
                }

                // Identify bottlenecks
                if (scenario.metrics.errorRate > 5) {
                    summary.bottlenecks.push({
                        scenario: scenario.scenario,
                        issue: 'High error rate',
                        value: scenario.metrics.errorRate
                    });
                }

                if (scenario.metrics.p95ResponseTime > 5000) {
                    summary.bottlenecks.push({
                        scenario: scenario.scenario,
                        issue: 'High response time',
                        value: scenario.metrics.p95ResponseTime
                    });
                }
            }
        }

        summary.avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
        summary.overallErrorRate = summary.totalRequests > 0 ? 
            (summary.totalErrors / summary.totalRequests) * 100 : 0;

        // Determine overall performance
        if (summary.maxErrorRate > 10 || summary.avgResponseTime > 3000) {
            summary.performance = 'POOR';
        } else if (summary.maxErrorRate > 5 || summary.avgResponseTime > 1500) {
            summary.performance = 'FAIR';
        }

        return summary;
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(summary) {
        const recommendations = [];

        if (summary.maxErrorRate > 5) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Error Rate',
                issue: `High error rate detected (${summary.maxErrorRate.toFixed(2)}%)`,
                recommendation: 'Investigate error causes and implement retry mechanisms',
                impact: 'System reliability'
            });
        }

        if (summary.avgResponseTime > 2000) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Performance',
                issue: `Slow average response time (${summary.avgResponseTime.toFixed(0)}ms)`,
                recommendation: 'Optimize database queries and implement caching',
                impact: 'User experience'
            });
        }

        for (const bottleneck of summary.bottlenecks) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Bottleneck',
                issue: `${bottleneck.scenario}: ${bottleneck.issue}`,
                recommendation: this.getBottleneckRecommendation(bottleneck),
                impact: 'System scalability'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'INFO',
                category: 'Performance',
                issue: 'System performing well under load',
                recommendation: 'Continue monitoring and consider increasing test load',
                impact: 'Capacity planning'
            });
        }

        return recommendations;
    }

    getBottleneckRecommendation(bottleneck) {
        const recommendations = {
            'evidence_upload': 'Consider implementing file chunking and parallel uploads',
            'evidence_verification': 'Optimize hash calculation and implement verification caching',
            'hash_verification': 'Use hardware acceleration for cryptographic operations',
            'blockchain_write': 'Implement blockchain write batching and queuing',
            'database_stress': 'Scale database resources and optimize connection pooling'
        };

        return recommendations[bottleneck.scenario] || 'Investigate and optimize the identified bottleneck';
    }

    // Helper methods
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async createTestEvidence(count) {
        // Mock evidence creation for testing
        const evidenceIds = [];
        for (let i = 0; i < count; i++) {
            evidenceIds.push(crypto.randomUUID());
        }
        return evidenceIds;
    }

    /**
     * Cleanup workers
     */
    async cleanup() {
        for (const worker of this.workers) {
            await worker.terminate();
        }
        this.workers = [];
    }
}

// Worker thread implementation
if (!isMainThread) {
    const { type, workerId, config, duration, evidenceIds } = workerData;
    
    const workerMetrics = {
        workerId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        timeouts: 0,
        responseTimes: []
    };

    const startTime = Date.now();
    const endTime = startTime + duration;

    async function runWorker() {
        while (Date.now() < endTime) {
            const requestStart = Date.now();
            
            try {
                await simulateRequest(type, config, evidenceIds);
                workerMetrics.successfulRequests++;
            } catch (error) {
                workerMetrics.failedRequests++;
            }
            
            const responseTime = Date.now() - requestStart;
            workerMetrics.responseTimes.push(responseTime);
            workerMetrics.totalRequests++;
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        parentPort.postMessage(workerMetrics);
    }

    async function simulateRequest(type, config, evidenceIds) {
        switch (type) {
            case 'upload':
                return simulateEvidenceUpload(config);
            case 'verification':
                return simulateEvidenceVerification(evidenceIds);
            case 'hash_verification':
                return simulateHashVerification(config);
            case 'blockchain':
                return simulateBlockchainWrite();
            case 'database':
                return simulateDatabaseOperation();
            default:
                throw new Error(`Unknown worker type: ${type}`);
        }
    }

    async function simulateEvidenceUpload(config) {
        // Simulate file upload processing
        const data = Buffer.alloc(config.evidenceSize, 'test-data');
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
        
        return { hash, size: data.length };
    }

    async function simulateEvidenceVerification(evidenceIds) {
        // Simulate evidence verification
        const evidenceId = evidenceIds[Math.floor(Math.random() * evidenceIds.length)];
        
        // Simulate verification processing
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
        
        return { evidenceId, verified: true };
    }

    async function simulateHashVerification(config) {
        // Simulate hash calculation
        const data = Buffer.alloc(config.evidenceSize, 'test-data');
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        return { hash };
    }

    async function simulateBlockchainWrite() {
        // Simulate blockchain write delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        return { transactionId: crypto.randomUUID() };
    }

    async function simulateDatabaseOperation() {
        // Simulate database query
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 100));
        
        return { result: 'success' };
    }

    runWorker().catch(error => {
        parentPort.postMessage({ error: error.message });
    });
}

module.exports = LoadTestingSuite;