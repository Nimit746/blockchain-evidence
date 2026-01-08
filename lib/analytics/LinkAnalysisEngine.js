/**
 * Cross-Case Link Analysis & Evidence Relationship Graph
 * Detects patterns and relationships across cases and evidence
 */

const crypto = require('crypto');

class LinkAnalysisEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.graphCache = new Map();
        this.similarityThreshold = 0.7;
        this.relationshipTypes = {
            SAME_EVIDENCE: 'same_evidence',
            SIMILAR_HASH: 'similar_hash',
            SAME_LOCATION: 'same_location',
            SAME_PERSON: 'same_person',
            SAME_DEVICE: 'same_device',
            TEMPORAL_PROXIMITY: 'temporal_proximity',
            METADATA_SIMILARITY: 'metadata_similarity'
        };
    }

    /**
     * Build comprehensive relationship graph
     */
    async buildRelationshipGraph(options = {}) {
        const {
            includeTypes = Object.values(this.relationshipTypes),
            timeRange = null,
            caseIds = null,
            minConfidence = 0.5
        } = options;

        const graph = {
            nodes: new Map(),
            edges: new Map(),
            metadata: {
                generatedAt: new Date().toISOString(),
                options,
                statistics: {
                    totalNodes: 0,
                    totalEdges: 0,
                    nodeTypes: {},
                    edgeTypes: {}
                }
            }
        };

        try {
            // Get all relevant data
            const { cases, evidence, people } = await this.gatherGraphData(timeRange, caseIds);

            // Create nodes
            this.createCaseNodes(graph, cases);
            this.createEvidenceNodes(graph, evidence);
            this.createPersonNodes(graph, people);

            // Create relationships
            if (includeTypes.includes(this.relationshipTypes.SAME_EVIDENCE)) {
                await this.findSameEvidenceRelationships(graph, evidence);
            }

            if (includeTypes.includes(this.relationshipTypes.SIMILAR_HASH)) {
                await this.findSimilarHashRelationships(graph, evidence);
            }

            if (includeTypes.includes(this.relationshipTypes.SAME_LOCATION)) {
                await this.findLocationRelationships(graph, evidence);
            }

            if (includeTypes.includes(this.relationshipTypes.SAME_PERSON)) {
                await this.findPersonRelationships(graph, cases, people);
            }

            if (includeTypes.includes(this.relationshipTypes.SAME_DEVICE)) {
                await this.findDeviceRelationships(graph, evidence);
            }

            if (includeTypes.includes(this.relationshipTypes.TEMPORAL_PROXIMITY)) {
                await this.findTemporalRelationships(graph, evidence);
            }

            if (includeTypes.includes(this.relationshipTypes.METADATA_SIMILARITY)) {
                await this.findMetadataRelationships(graph, evidence);
            }

            // Filter by confidence
            this.filterByConfidence(graph, minConfidence);

            // Calculate statistics
            this.calculateGraphStatistics(graph);

            // Cache the result
            const cacheKey = crypto.createHash('md5').update(JSON.stringify(options)).digest('hex');
            this.graphCache.set(cacheKey, graph);

            return this.serializeGraph(graph);

        } catch (error) {
            console.error('Failed to build relationship graph:', error);
            throw error;
        }
    }

    /**
     * Gather all data needed for graph construction
     */
    async gatherGraphData(timeRange, caseIds) {
        let caseQuery = this.supabase.from('cases').select('*');
        let evidenceQuery = this.supabase.from('evidence').select('*');

        if (timeRange) {
            const startDate = new Date(Date.now() - this.parseTimeRange(timeRange));
            caseQuery = caseQuery.gte('created_at', startDate.toISOString());
            evidenceQuery = evidenceQuery.gte('created_at', startDate.toISOString());
        }

        if (caseIds && caseIds.length > 0) {
            caseQuery = caseQuery.in('id', caseIds);
            evidenceQuery = evidenceQuery.in('case_id', caseIds);
        }

        const [casesResult, evidenceResult, peopleResult] = await Promise.all([
            caseQuery,
            evidenceQuery,
            this.supabase.from('case_people').select(`
                *,
                cases:case_id (*),
                people:person_id (*)
            `)
        ]);

        return {
            cases: casesResult.data || [],
            evidence: evidenceResult.data || [],
            people: peopleResult.data || []
        };
    }

    /**
     * Create case nodes
     */
    createCaseNodes(graph, cases) {
        for (const caseData of cases) {
            const node = {
                id: `case_${caseData.id}`,
                type: 'case',
                label: caseData.title,
                data: {
                    id: caseData.id,
                    title: caseData.title,
                    status: caseData.status,
                    priority: caseData.priority,
                    created_at: caseData.created_at,
                    jurisdiction: caseData.jurisdiction
                },
                style: {
                    color: this.getCaseColor(caseData.status),
                    size: this.getCaseSize(caseData.priority),
                    shape: 'box'
                }
            };

            graph.nodes.set(node.id, node);
        }
    }

    /**
     * Create evidence nodes
     */
    createEvidenceNodes(graph, evidence) {
        for (const evidenceData of evidence) {
            const node = {
                id: `evidence_${evidenceData.id}`,
                type: 'evidence',
                label: evidenceData.filename,
                data: {
                    id: evidenceData.id,
                    filename: evidenceData.filename,
                    file_type: evidenceData.file_type,
                    file_hash: evidenceData.file_hash,
                    case_id: evidenceData.case_id,
                    created_at: evidenceData.created_at,
                    metadata: evidenceData.metadata
                },
                style: {
                    color: this.getEvidenceColor(evidenceData.file_type),
                    size: 20,
                    shape: 'circle'
                }
            };

            graph.nodes.set(node.id, node);

            // Create edge to parent case
            const caseEdge = {
                id: `${node.id}_to_case_${evidenceData.case_id}`,
                source: node.id,
                target: `case_${evidenceData.case_id}`,
                type: 'belongs_to',
                weight: 1.0,
                style: {
                    color: '#666',
                    width: 2
                }
            };

            graph.edges.set(caseEdge.id, caseEdge);
        }
    }

    /**
     * Create person nodes
     */
    createPersonNodes(graph, people) {
        const personMap = new Map();

        for (const relation of people) {
            if (!relation.people) continue;

            const person = relation.people;
            const personId = `person_${person.id}`;

            if (!personMap.has(personId)) {
                const node = {
                    id: personId,
                    type: 'person',
                    label: person.name,
                    data: {
                        id: person.id,
                        name: person.name,
                        role: person.role,
                        contact_info: person.contact_info
                    },
                    style: {
                        color: this.getPersonColor(person.role),
                        size: 25,
                        shape: 'triangle'
                    }
                };

                graph.nodes.set(personId, node);
                personMap.set(personId, node);
            }

            // Create edge to case
            const caseEdge = {
                id: `${personId}_to_case_${relation.case_id}`,
                source: personId,
                target: `case_${relation.case_id}`,
                type: 'involved_in',
                weight: 0.8,
                data: {
                    relationship: relation.relationship,
                    role: relation.role
                },
                style: {
                    color: '#999',
                    width: 1
                }
            };

            graph.edges.set(caseEdge.id, caseEdge);
        }
    }

    /**
     * Find same evidence relationships (exact duplicates)
     */
    async findSameEvidenceRelationships(graph, evidence) {
        const hashGroups = new Map();

        // Group evidence by hash
        for (const item of evidence) {
            if (!item.file_hash) continue;

            if (!hashGroups.has(item.file_hash)) {
                hashGroups.set(item.file_hash, []);
            }
            hashGroups.get(item.file_hash).push(item);
        }

        // Create relationships for duplicate evidence
        for (const [hash, items] of hashGroups) {
            if (items.length < 2) continue;

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const edge = {
                        id: `same_evidence_${items[i].id}_${items[j].id}`,
                        source: `evidence_${items[i].id}`,
                        target: `evidence_${items[j].id}`,
                        type: this.relationshipTypes.SAME_EVIDENCE,
                        weight: 1.0,
                        confidence: 1.0,
                        data: {
                            hash,
                            reason: 'Identical file hash'
                        },
                        style: {
                            color: '#ff0000',
                            width: 3,
                            dashes: false
                        }
                    };

                    graph.edges.set(edge.id, edge);
                }
            }
        }
    }

    /**
     * Find similar hash relationships (partial matches)
     */
    async findSimilarHashRelationships(graph, evidence) {
        const hashes = evidence.filter(e => e.file_hash).map(e => ({
            id: e.id,
            hash: e.file_hash,
            filename: e.filename
        }));

        for (let i = 0; i < hashes.length; i++) {
            for (let j = i + 1; j < hashes.length; j++) {
                const similarity = this.calculateHashSimilarity(hashes[i].hash, hashes[j].hash);
                
                if (similarity > this.similarityThreshold && similarity < 1.0) {
                    const edge = {
                        id: `similar_hash_${hashes[i].id}_${hashes[j].id}`,
                        source: `evidence_${hashes[i].id}`,
                        target: `evidence_${hashes[j].id}`,
                        type: this.relationshipTypes.SIMILAR_HASH,
                        weight: similarity,
                        confidence: similarity,
                        data: {
                            similarity,
                            reason: `${Math.round(similarity * 100)}% hash similarity`
                        },
                        style: {
                            color: '#ff9900',
                            width: Math.max(1, similarity * 3),
                            dashes: true
                        }
                    };

                    graph.edges.set(edge.id, edge);
                }
            }
        }
    }

    /**
     * Find location-based relationships
     */
    async findLocationRelationships(graph, evidence) {
        const locationGroups = new Map();

        for (const item of evidence) {
            const location = this.extractLocation(item.metadata);
            if (!location) continue;

            const locationKey = `${Math.round(location.lat * 1000)}_${Math.round(location.lng * 1000)}`;
            
            if (!locationGroups.has(locationKey)) {
                locationGroups.set(locationKey, []);
            }
            locationGroups.get(locationKey).push({ ...item, location });
        }

        // Create relationships for evidence from same location
        for (const [locationKey, items] of locationGroups) {
            if (items.length < 2) continue;

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const distance = this.calculateDistance(
                        items[i].location,
                        items[j].location
                    );

                    if (distance < 100) { // Within 100 meters
                        const edge = {
                            id: `same_location_${items[i].id}_${items[j].id}`,
                            source: `evidence_${items[i].id}`,
                            target: `evidence_${items[j].id}`,
                            type: this.relationshipTypes.SAME_LOCATION,
                            weight: Math.max(0.1, 1 - (distance / 100)),
                            confidence: Math.max(0.5, 1 - (distance / 100)),
                            data: {
                                distance,
                                location: items[i].location,
                                reason: `Captured within ${Math.round(distance)}m`
                            },
                            style: {
                                color: '#00ff00',
                                width: 2,
                                dashes: false
                            }
                        };

                        graph.edges.set(edge.id, edge);
                    }
                }
            }
        }
    }

    /**
     * Find temporal relationships
     */
    async findTemporalRelationships(graph, evidence) {
        const timeWindow = 60 * 60 * 1000; // 1 hour in milliseconds

        for (let i = 0; i < evidence.length; i++) {
            for (let j = i + 1; j < evidence.length; j++) {
                const time1 = new Date(evidence[i].created_at).getTime();
                const time2 = new Date(evidence[j].created_at).getTime();
                const timeDiff = Math.abs(time1 - time2);

                if (timeDiff < timeWindow) {
                    const proximity = 1 - (timeDiff / timeWindow);
                    
                    const edge = {
                        id: `temporal_${evidence[i].id}_${evidence[j].id}`,
                        source: `evidence_${evidence[i].id}`,
                        target: `evidence_${evidence[j].id}`,
                        type: this.relationshipTypes.TEMPORAL_PROXIMITY,
                        weight: proximity,
                        confidence: proximity * 0.7, // Lower confidence for temporal relationships
                        data: {
                            timeDiff: Math.round(timeDiff / 1000 / 60), // minutes
                            reason: `Captured within ${Math.round(timeDiff / 1000 / 60)} minutes`
                        },
                        style: {
                            color: '#0099ff',
                            width: Math.max(1, proximity * 2),
                            dashes: true
                        }
                    };

                    graph.edges.set(edge.id, edge);
                }
            }
        }
    }

    /**
     * Find device-based relationships
     */
    async findDeviceRelationships(graph, evidence) {
        const deviceGroups = new Map();

        for (const item of evidence) {
            const deviceId = this.extractDeviceId(item.metadata);
            if (!deviceId) continue;

            if (!deviceGroups.has(deviceId)) {
                deviceGroups.set(deviceId, []);
            }
            deviceGroups.get(deviceId).push(item);
        }

        // Create relationships for evidence from same device
        for (const [deviceId, items] of deviceGroups) {
            if (items.length < 2) continue;

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const edge = {
                        id: `same_device_${items[i].id}_${items[j].id}`,
                        source: `evidence_${items[i].id}`,
                        target: `evidence_${items[j].id}`,
                        type: this.relationshipTypes.SAME_DEVICE,
                        weight: 0.9,
                        confidence: 0.9,
                        data: {
                            deviceId,
                            reason: `Captured by same device: ${deviceId}`
                        },
                        style: {
                            color: '#9900ff',
                            width: 2,
                            dashes: false
                        }
                    };

                    graph.edges.set(edge.id, edge);
                }
            }
        }
    }

    /**
     * Find metadata similarity relationships
     */
    async findMetadataRelationships(graph, evidence) {
        for (let i = 0; i < evidence.length; i++) {
            for (let j = i + 1; j < evidence.length; j++) {
                const similarity = this.calculateMetadataSimilarity(
                    evidence[i].metadata,
                    evidence[j].metadata
                );

                if (similarity > this.similarityThreshold) {
                    const edge = {
                        id: `metadata_similarity_${evidence[i].id}_${evidence[j].id}`,
                        source: `evidence_${evidence[i].id}`,
                        target: `evidence_${evidence[j].id}`,
                        type: this.relationshipTypes.METADATA_SIMILARITY,
                        weight: similarity,
                        confidence: similarity * 0.8,
                        data: {
                            similarity,
                            reason: `${Math.round(similarity * 100)}% metadata similarity`
                        },
                        style: {
                            color: '#ffff00',
                            width: Math.max(1, similarity * 2),
                            dashes: true
                        }
                    };

                    graph.edges.set(edge.id, edge);
                }
            }
        }
    }

    /**
     * Helper methods
     */
    calculateHashSimilarity(hash1, hash2) {
        if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] === hash2[i]) matches++;
        }
        
        return matches / hash1.length;
    }

    calculateDistance(loc1, loc2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
        const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateMetadataSimilarity(meta1, meta2) {
        if (!meta1 || !meta2) return 0;
        
        const keys1 = new Set(Object.keys(meta1));
        const keys2 = new Set(Object.keys(meta2));
        const allKeys = new Set([...keys1, ...keys2]);
        
        let matches = 0;
        for (const key of allKeys) {
            if (meta1[key] === meta2[key]) matches++;
        }
        
        return matches / allKeys.size;
    }

    extractLocation(metadata) {
        if (!metadata) return null;
        
        if (metadata.gps && metadata.gps.lat && metadata.gps.lng) {
            return { lat: metadata.gps.lat, lng: metadata.gps.lng };
        }
        
        if (metadata.location && metadata.location.latitude && metadata.location.longitude) {
            return { lat: metadata.location.latitude, lng: metadata.location.longitude };
        }
        
        return null;
    }

    extractDeviceId(metadata) {
        if (!metadata) return null;
        
        return metadata.deviceId || 
               metadata.device_id || 
               metadata.camera?.serialNumber ||
               metadata.exif?.Make + '_' + metadata.exif?.Model ||
               null;
    }

    getCaseColor(status) {
        const colors = {
            'open': '#ff6b6b',
            'in_progress': '#feca57',
            'closed': '#48dbfb',
            'archived': '#a4b0be'
        };
        return colors[status] || '#ddd';
    }

    getCaseSize(priority) {
        const sizes = {
            'low': 30,
            'medium': 40,
            'high': 50,
            'critical': 60
        };
        return sizes[priority] || 35;
    }

    getEvidenceColor(fileType) {
        if (fileType?.startsWith('image/')) return '#00d2d3';
        if (fileType?.startsWith('video/')) return '#ff9ff3';
        if (fileType?.startsWith('audio/')) return '#54a0ff';
        if (fileType?.includes('pdf')) return '#5f27cd';
        return '#c8d6e5';
    }

    getPersonColor(role) {
        const colors = {
            'suspect': '#ff3838',
            'witness': '#2ed573',
            'victim': '#ffa502',
            'officer': '#3742fa'
        };
        return colors[role] || '#747d8c';
    }

    filterByConfidence(graph, minConfidence) {
        for (const [edgeId, edge] of graph.edges) {
            if (edge.confidence < minConfidence) {
                graph.edges.delete(edgeId);
            }
        }
    }

    calculateGraphStatistics(graph) {
        const stats = graph.metadata.statistics;
        
        stats.totalNodes = graph.nodes.size;
        stats.totalEdges = graph.edges.size;
        
        // Count node types
        for (const node of graph.nodes.values()) {
            stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;
        }
        
        // Count edge types
        for (const edge of graph.edges.values()) {
            stats.edgeTypes[edge.type] = (stats.edgeTypes[edge.type] || 0) + 1;
        }
    }

    serializeGraph(graph) {
        return {
            nodes: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges.values()),
            metadata: graph.metadata
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
     * Generate investigation insights
     */
    async generateInsights(graph) {
        const insights = [];

        // Find evidence clusters
        const clusters = this.findClusters(graph);
        if (clusters.length > 0) {
            insights.push({
                type: 'EVIDENCE_CLUSTERS',
                severity: 'HIGH',
                title: 'Evidence Clusters Detected',
                description: `Found ${clusters.length} clusters of related evidence across cases`,
                data: clusters
            });
        }

        // Find cross-case connections
        const crossCaseConnections = this.findCrossCaseConnections(graph);
        if (crossCaseConnections.length > 0) {
            insights.push({
                type: 'CROSS_CASE_LINKS',
                severity: 'CRITICAL',
                title: 'Cross-Case Evidence Links',
                description: `Evidence appears in multiple cases: potential serial activity`,
                data: crossCaseConnections
            });
        }

        // Find temporal patterns
        const temporalPatterns = this.findTemporalPatterns(graph);
        if (temporalPatterns.length > 0) {
            insights.push({
                type: 'TEMPORAL_PATTERNS',
                severity: 'MEDIUM',
                title: 'Temporal Activity Patterns',
                description: 'Evidence shows temporal clustering suggesting coordinated activity',
                data: temporalPatterns
            });
        }

        return insights;
    }

    findClusters(graph) {
        // Simplified clustering algorithm
        const visited = new Set();
        const clusters = [];

        for (const node of graph.nodes.values()) {
            if (visited.has(node.id) || node.type !== 'evidence') continue;

            const cluster = this.exploreCluster(graph, node.id, visited);
            if (cluster.length > 2) {
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    exploreCluster(graph, nodeId, visited) {
        const cluster = [];
        const stack = [nodeId];

        while (stack.length > 0) {
            const currentId = stack.pop();
            if (visited.has(currentId)) continue;

            visited.add(currentId);
            cluster.push(currentId);

            // Find connected evidence nodes
            for (const edge of graph.edges.values()) {
                if (edge.source === currentId || edge.target === currentId) {
                    const connectedId = edge.source === currentId ? edge.target : edge.source;
                    const connectedNode = graph.nodes.get(connectedId);
                    
                    if (connectedNode && connectedNode.type === 'evidence' && !visited.has(connectedId)) {
                        stack.push(connectedId);
                    }
                }
            }
        }

        return cluster;
    }

    findCrossCaseConnections(graph) {
        const connections = [];
        const evidenceToCase = new Map();

        // Map evidence to cases
        for (const node of graph.nodes.values()) {
            if (node.type === 'evidence') {
                evidenceToCase.set(node.id, node.data.case_id);
            }
        }

        // Find evidence connected across cases
        for (const edge of graph.edges.values()) {
            const sourceCase = evidenceToCase.get(edge.source);
            const targetCase = evidenceToCase.get(edge.target);

            if (sourceCase && targetCase && sourceCase !== targetCase) {
                connections.push({
                    evidence1: edge.source,
                    evidence2: edge.target,
                    case1: sourceCase,
                    case2: targetCase,
                    relationship: edge.type,
                    confidence: edge.confidence
                });
            }
        }

        return connections;
    }

    findTemporalPatterns(graph) {
        // Simplified temporal pattern detection
        const patterns = [];
        const timeGroups = new Map();

        for (const node of graph.nodes.values()) {
            if (node.type !== 'evidence') continue;

            const date = new Date(node.data.created_at);
            const hourKey = `${date.getHours()}:00`;
            
            if (!timeGroups.has(hourKey)) {
                timeGroups.set(hourKey, []);
            }
            timeGroups.get(hourKey).push(node);
        }

        for (const [time, nodes] of timeGroups) {
            if (nodes.length > 3) {
                patterns.push({
                    time,
                    evidenceCount: nodes.length,
                    evidence: nodes.map(n => n.id)
                });
            }
        }

        return patterns;
    }
}

module.exports = LinkAnalysisEngine;