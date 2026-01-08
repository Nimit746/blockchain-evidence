/**
 * Centralized Security Audit Log System
 * Advanced filtering, search, and export capabilities
 */

const crypto = require('crypto');

class SecurityAuditLogger {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.savedFilters = new Map();
        this.exportFormats = ['CSV', 'JSON', 'XML'];
        this.maxExportRecords = 10000;
    }

    /**
     * Log security event
     */
    async logSecurityEvent(eventData) {
        const event = {
            id: crypto.randomUUID(),
            event_type: eventData.eventType,
            severity: eventData.severity || 'INFO',
            user_id: eventData.userId,
            ip_address: eventData.ipAddress,
            user_agent: eventData.userAgent,
            resource_type: eventData.resourceType,
            resource_id: eventData.resourceId,
            action: eventData.action,
            policy_result: eventData.policyResult,
            attributes: eventData.attributes,
            metadata: eventData.metadata || {},
            created_at: new Date().toISOString()
        };

        try {
            const { data, error } = await this.supabase
                .from('security_events')
                .insert([event]);

            if (error) throw error;

            // Emit real-time event for monitoring
            if (global.io) {
                global.io.emit('security_event', event);
            }

            return event;
        } catch (error) {
            console.error('Failed to log security event:', error);
            throw error;
        }
    }

    /**
     * Search audit logs with advanced filtering
     */
    async searchAuditLogs(filters = {}, pagination = {}) {
        const {
            page = 1,
            limit = 50,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = pagination;

        let query = this.supabase
            .from('security_events')
            .select(`
                *,
                users:user_id (
                    id,
                    email,
                    role,
                    full_name
                )
            `);

        // Apply filters
        if (filters.eventTypes && filters.eventTypes.length > 0) {
            query = query.in('event_type', filters.eventTypes);
        }

        if (filters.severities && filters.severities.length > 0) {
            query = query.in('severity', filters.severities);
        }

        if (filters.userIds && filters.userIds.length > 0) {
            query = query.in('user_id', filters.userIds);
        }

        if (filters.ipAddresses && filters.ipAddresses.length > 0) {
            query = query.in('ip_address', filters.ipAddresses);
        }

        if (filters.resourceTypes && filters.resourceTypes.length > 0) {
            query = query.in('resource_type', filters.resourceTypes);
        }

        if (filters.actions && filters.actions.length > 0) {
            query = query.in('action', filters.actions);
        }

        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }

        if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo);
        }

        if (filters.searchText) {
            query = query.or(`
                event_type.ilike.%${filters.searchText}%,
                action.ilike.%${filters.searchText}%,
                metadata->>description.ilike.%${filters.searchText}%
            `);
        }

        // Apply sorting and pagination
        query = query
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range((page - 1) * limit, page * limit - 1);

        try {
            const { data, error, count } = await query;
            if (error) throw error;

            return {
                events: data || [],
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            console.error('Failed to search audit logs:', error);
            throw error;
        }
    }

    /**
     * Get audit log statistics
     */
    async getAuditStatistics(timeRange = '7d') {
        const timeRanges = {
            '1d': '1 day',
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days'
        };

        const interval = timeRanges[timeRange] || '7 days';

        try {
            // Event type distribution
            const { data: eventTypes } = await this.supabase
                .from('security_events')
                .select('event_type, count(*)')
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(interval)).toISOString())
                .group('event_type');

            // Severity distribution
            const { data: severities } = await this.supabase
                .from('security_events')
                .select('severity, count(*)')
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(interval)).toISOString())
                .group('severity');

            // Top users by activity
            const { data: topUsers } = await this.supabase
                .from('security_events')
                .select(`
                    user_id,
                    count(*),
                    users:user_id (email, full_name)
                `)
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(interval)).toISOString())
                .not('user_id', 'is', null)
                .group('user_id')
                .order('count', { ascending: false })
                .limit(10);

            // Top IP addresses
            const { data: topIPs } = await this.supabase
                .from('security_events')
                .select('ip_address, count(*)')
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(interval)).toISOString())
                .not('ip_address', 'is', null)
                .group('ip_address')
                .order('count', { ascending: false })
                .limit(10);

            // Timeline data
            const { data: timeline } = await this.supabase
                .from('security_events')
                .select(`
                    DATE(created_at) as date,
                    event_type,
                    count(*)
                `)
                .gte('created_at', new Date(Date.now() - this.parseTimeRange(interval)).toISOString())
                .group('DATE(created_at), event_type')
                .order('date');

            return {
                timeRange,
                eventTypes: eventTypes || [],
                severities: severities || [],
                topUsers: topUsers || [],
                topIPs: topIPs || [],
                timeline: timeline || []
            };
        } catch (error) {
            console.error('Failed to get audit statistics:', error);
            throw error;
        }
    }

    /**
     * Save reusable filter
     */
    async saveFilter(name, filters, userId) {
        const savedFilter = {
            id: crypto.randomUUID(),
            name,
            filters,
            created_by: userId,
            created_at: new Date().toISOString()
        };

        try {
            const { data, error } = await this.supabase
                .from('saved_audit_filters')
                .insert([savedFilter]);

            if (error) throw error;

            this.savedFilters.set(savedFilter.id, savedFilter);
            return savedFilter;
        } catch (error) {
            console.error('Failed to save filter:', error);
            throw error;
        }
    }

    /**
     * Get saved filters for user
     */
    async getSavedFilters(userId) {
        try {
            const { data, error } = await this.supabase
                .from('saved_audit_filters')
                .select('*')
                .eq('created_by', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Failed to get saved filters:', error);
            throw error;
        }
    }

    /**
     * Export audit logs
     */
    async exportAuditLogs(filters = {}, format = 'CSV', userId) {
        if (!this.exportFormats.includes(format)) {
            throw new Error(`Unsupported export format: ${format}`);
        }

        // Get data with no pagination limit but cap at maxExportRecords
        const { events } = await this.searchAuditLogs(filters, { 
            page: 1, 
            limit: this.maxExportRecords 
        });

        const exportData = {
            exportId: crypto.randomUUID(),
            format,
            recordCount: events.length,
            filters,
            exportedBy: userId,
            exportedAt: new Date().toISOString(),
            data: events
        };

        // Generate digital signature for forensic integrity
        const signature = this.generateExportSignature(exportData);
        exportData.digitalSignature = signature;

        let exportContent;
        let mimeType;
        let fileExtension;

        switch (format) {
            case 'CSV':
                exportContent = this.generateCSV(events);
                mimeType = 'text/csv';
                fileExtension = 'csv';
                break;
            case 'JSON':
                exportContent = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
                fileExtension = 'json';
                break;
            case 'XML':
                exportContent = this.generateXML(exportData);
                mimeType = 'application/xml';
                fileExtension = 'xml';
                break;
        }

        // Log the export activity
        await this.logSecurityEvent({
            eventType: 'AUDIT_LOG_EXPORT',
            severity: 'MEDIUM',
            userId,
            action: 'export',
            resourceType: 'audit_logs',
            metadata: {
                format,
                recordCount: events.length,
                filters,
                exportId: exportData.exportId
            }
        });

        return {
            exportId: exportData.exportId,
            content: exportContent,
            mimeType,
            fileExtension,
            filename: `audit_logs_${new Date().toISOString().split('T')[0]}.${fileExtension}`,
            signature: signature.hash
        };
    }

    /**
     * Generate CSV format
     */
    generateCSV(events) {
        if (events.length === 0) return '';

        const headers = [
            'ID', 'Timestamp', 'Event Type', 'Severity', 'User Email', 'User Role',
            'IP Address', 'User Agent', 'Resource Type', 'Resource ID', 'Action',
            'Policy Result', 'Metadata'
        ];

        const rows = events.map(event => [
            event.id,
            event.created_at,
            event.event_type,
            event.severity,
            event.users?.email || '',
            event.users?.role || '',
            event.ip_address || '',
            event.user_agent || '',
            event.resource_type || '',
            event.resource_id || '',
            event.action || '',
            JSON.stringify(event.policy_result || {}),
            JSON.stringify(event.metadata || {})
        ]);

        return [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }

    /**
     * Generate XML format
     */
    generateXML(exportData) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<AuditLogExport>\n';
        xml += `  <ExportInfo>\n`;
        xml += `    <ExportId>${exportData.exportId}</ExportId>\n`;
        xml += `    <ExportedAt>${exportData.exportedAt}</ExportedAt>\n`;
        xml += `    <ExportedBy>${exportData.exportedBy}</ExportedBy>\n`;
        xml += `    <RecordCount>${exportData.recordCount}</RecordCount>\n`;
        xml += `    <Format>${exportData.format}</Format>\n`;
        xml += `  </ExportInfo>\n`;
        xml += `  <DigitalSignature>${exportData.digitalSignature.hash}</DigitalSignature>\n`;
        xml += `  <Events>\n`;

        for (const event of exportData.data) {
            xml += `    <Event>\n`;
            xml += `      <ID>${event.id}</ID>\n`;
            xml += `      <Timestamp>${event.created_at}</Timestamp>\n`;
            xml += `      <EventType>${event.event_type}</EventType>\n`;
            xml += `      <Severity>${event.severity}</Severity>\n`;
            xml += `      <UserEmail>${event.users?.email || ''}</UserEmail>\n`;
            xml += `      <UserRole>${event.users?.role || ''}</UserRole>\n`;
            xml += `      <IPAddress>${event.ip_address || ''}</IPAddress>\n`;
            xml += `      <ResourceType>${event.resource_type || ''}</ResourceType>\n`;
            xml += `      <Action>${event.action || ''}</Action>\n`;
            xml += `      <Metadata><![CDATA[${JSON.stringify(event.metadata || {})}]]></Metadata>\n`;
            xml += `    </Event>\n`;
        }

        xml += `  </Events>\n`;
        xml += '</AuditLogExport>';

        return xml;
    }

    /**
     * Generate digital signature for export integrity
     */
    generateExportSignature(exportData) {
        const signatureData = {
            exportId: exportData.exportId,
            recordCount: exportData.recordCount,
            exportedAt: exportData.exportedAt,
            exportedBy: exportData.exportedBy,
            dataHash: crypto.createHash('sha256')
                .update(JSON.stringify(exportData.data))
                .digest('hex')
        };

        const hash = crypto.createHash('sha256')
            .update(JSON.stringify(signatureData))
            .digest('hex');

        return {
            algorithm: 'SHA-256',
            hash,
            signatureData,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Verify export signature
     */
    verifyExportSignature(exportContent, signature) {
        try {
            const exportData = JSON.parse(exportContent);
            const regeneratedSignature = this.generateExportSignature(exportData);
            return regeneratedSignature.hash === signature;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get audit log trends
     */
    async getAuditTrends(timeRange = '30d') {
        const interval = this.parseTimeRange(timeRange);
        const startDate = new Date(Date.now() - interval);

        try {
            const { data, error } = await this.supabase
                .from('security_events')
                .select(`
                    DATE(created_at) as date,
                    severity,
                    count(*)
                `)
                .gte('created_at', startDate.toISOString())
                .group('DATE(created_at), severity')
                .order('date');

            if (error) throw error;

            // Process data for trend analysis
            const trends = {};
            const severityLevels = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

            for (const row of data || []) {
                if (!trends[row.date]) {
                    trends[row.date] = { date: row.date, total: 0 };
                    severityLevels.forEach(level => trends[row.date][level] = 0);
                }
                trends[row.date][row.severity] = parseInt(row.count);
                trends[row.date].total += parseInt(row.count);
            }

            return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('Failed to get audit trends:', error);
            throw error;
        }
    }

    /**
     * Parse time range string to milliseconds
     */
    parseTimeRange(timeRange) {
        const units = {
            'd': 24 * 60 * 60 * 1000,
            'h': 60 * 60 * 1000,
            'm': 60 * 1000
        };

        const match = timeRange.match(/^(\d+)([dhm])$/);
        if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }

    /**
     * Clean up old audit logs based on retention policy
     */
    async cleanupOldLogs(retentionDays = 365) {
        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

        try {
            const { data, error } = await this.supabase
                .from('security_events')
                .delete()
                .lt('created_at', cutoffDate.toISOString());

            if (error) throw error;

            await this.logSecurityEvent({
                eventType: 'AUDIT_LOG_CLEANUP',
                severity: 'INFO',
                action: 'cleanup',
                resourceType: 'audit_logs',
                metadata: {
                    retentionDays,
                    cutoffDate: cutoffDate.toISOString(),
                    deletedRecords: data?.length || 0
                }
            });

            return { deletedRecords: data?.length || 0 };
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
            throw error;
        }
    }
}

module.exports = SecurityAuditLogger;