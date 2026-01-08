/**
 * Security Hardening Middleware
 * Rate limiting, IP throttling, and suspicious activity detection
 */

const rateLimit = require('express-rate-limit');

class SecurityHardening {
    constructor() {
        this.suspiciousActivities = new Map();
        this.ipAttempts = new Map();
        this.geoCache = new Map();
        this.alertThresholds = {
            failedLogins: 5,
            rapidRequests: 100,
            geoAnomalyMinutes: 30
        };
    }

    // Rate limiters
    createLoginLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            message: { error: 'Too many login attempts, try again later' },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSuspiciousActivity(req.ip, 'RATE_LIMIT_EXCEEDED', 'login');
                res.status(429).json({ error: 'Too many login attempts' });
            }
        });
    }

    createEvidenceDownloadLimiter() {
        return rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 10, // 10 downloads per minute
            message: { error: 'Download rate limit exceeded' },
            keyGenerator: (req) => `${req.ip}-${req.user?.id || 'anonymous'}`,
            handler: (req, res) => {
                this.logSuspiciousActivity(req.ip, 'DOWNLOAD_RATE_EXCEEDED', req.user?.id);
                res.status(429).json({ error: 'Download rate limit exceeded' });
            }
        });
    }

    createMetaMaskLimiter() {
        return rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 3, // 3 MetaMask connection attempts
            message: { error: 'Too many MetaMask connection attempts' },
            handler: (req, res) => {
                this.logSuspiciousActivity(req.ip, 'METAMASK_RATE_EXCEEDED');
                res.status(429).json({ error: 'MetaMask connection rate limit exceeded' });
            }
        });
    }

    // Geo/IP anomaly detection
    async detectGeoAnomaly(userId, ipAddress, userAgent) {
        const userKey = `user_${userId}`;
        const currentLocation = await this.getLocationFromIP(ipAddress);
        const lastActivity = this.geoCache.get(userKey);

        if (lastActivity) {
            const timeDiff = Date.now() - lastActivity.timestamp;
            const distance = this.calculateDistance(
                lastActivity.location, 
                currentLocation
            );

            // Impossible travel detection (>1000km in <30 minutes)
            if (distance > 1000 && timeDiff < 30 * 60 * 1000) {
                await this.triggerGeoAnomalyAlert(userId, {
                    previousLocation: lastActivity.location,
                    currentLocation,
                    distance,
                    timeDiff,
                    ipAddress,
                    userAgent
                });
                return true;
            }
        }

        this.geoCache.set(userKey, {
            location: currentLocation,
            timestamp: Date.now(),
            ipAddress
        });

        return false;
    }

    async getLocationFromIP(ipAddress) {
        // Mock implementation - in production use GeoIP service
        const mockLocations = {
            '127.0.0.1': { country: 'Local', lat: 0, lng: 0 },
            '192.168.1.1': { country: 'Local', lat: 0, lng: 0 }
        };
        
        return mockLocations[ipAddress] || { 
            country: 'Unknown', 
            lat: Math.random() * 180 - 90, 
            lng: Math.random() * 360 - 180 
        };
    }

    calculateDistance(loc1, loc2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(loc2.lat - loc1.lat);
        const dLon = this.toRad(loc2.lng - loc1.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    // Suspicious activity logging
    logSuspiciousActivity(ipAddress, activityType, userId = null, metadata = {}) {
        const key = `${ipAddress}-${activityType}`;
        const activity = {
            ipAddress,
            activityType,
            userId,
            timestamp: new Date(),
            metadata,
            count: 1
        };

        if (this.suspiciousActivities.has(key)) {
            const existing = this.suspiciousActivities.get(key);
            existing.count++;
            existing.lastSeen = new Date();
        } else {
            this.suspiciousActivities.set(key, activity);
        }

        // Check if we need to trigger alerts
        this.checkAlertThresholds(key, activity);
    }

    checkAlertThresholds(key, activity) {
        const { activityType, count, ipAddress, userId } = activity;

        let shouldAlert = false;
        let alertReason = '';

        switch (activityType) {
            case 'FAILED_LOGIN':
                if (count >= this.alertThresholds.failedLogins) {
                    shouldAlert = true;
                    alertReason = `${count} failed login attempts from ${ipAddress}`;
                }
                break;
            case 'RATE_LIMIT_EXCEEDED':
                shouldAlert = true;
                alertReason = `Rate limit exceeded by ${ipAddress}`;
                break;
            case 'DOWNLOAD_RATE_EXCEEDED':
                shouldAlert = true;
                alertReason = `Evidence download rate exceeded by user ${userId} from ${ipAddress}`;
                break;
        }

        if (shouldAlert) {
            this.triggerSecurityAlert(alertReason, activity);
        }
    }

    async triggerSecurityAlert(reason, activity) {
        const alert = {
            id: `alert_${Date.now()}`,
            type: 'SECURITY_ALERT',
            severity: 'HIGH',
            reason,
            activity,
            timestamp: new Date()
        };

        console.warn('🚨 Security Alert:', alert);

        // In production, send to monitoring system, email admins, etc.
        // For now, we'll emit a WebSocket event
        if (global.io) {
            global.io.emit('security_alert', alert);
        }

        return alert;
    }

    async triggerGeoAnomalyAlert(userId, anomalyData) {
        const alert = {
            id: `geo_alert_${Date.now()}`,
            type: 'GEO_ANOMALY',
            severity: 'CRITICAL',
            userId,
            reason: 'Impossible travel detected',
            data: anomalyData,
            timestamp: new Date()
        };

        console.warn('🌍 Geo Anomaly Alert:', alert);

        if (global.io) {
            global.io.emit('geo_anomaly_alert', alert);
        }

        return alert;
    }

    // IP reputation checking
    async checkIPReputation(ipAddress) {
        // Mock implementation - in production integrate with threat intelligence
        const knownBadIPs = ['192.168.100.100', '10.0.0.100'];
        const isMalicious = knownBadIPs.includes(ipAddress);
        
        return {
            ipAddress,
            isMalicious,
            reputation: isMalicious ? 'BAD' : 'GOOD',
            sources: isMalicious ? ['internal_blacklist'] : []
        };
    }

    // Middleware functions
    securityMiddleware() {
        return async (req, res, next) => {
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            // Check IP reputation
            const ipReputation = await this.checkIPReputation(ipAddress);
            if (ipReputation.isMalicious) {
                this.logSuspiciousActivity(ipAddress, 'MALICIOUS_IP');
                return res.status(403).json({ error: 'Access denied' });
            }

            // Detect geo anomalies for authenticated users
            if (req.user) {
                const hasAnomaly = await this.detectGeoAnomaly(
                    req.user.id, 
                    ipAddress, 
                    userAgent
                );
                if (hasAnomaly) {
                    req.geoAnomalyDetected = true;
                }
            }

            // Add security headers
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            });

            next();
        };
    }

    // Cleanup old entries
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [key, activity] of this.suspiciousActivities.entries()) {
            if (now - activity.timestamp.getTime() > maxAge) {
                this.suspiciousActivities.delete(key);
            }
        }

        for (const [key, data] of this.geoCache.entries()) {
            if (now - data.timestamp > maxAge) {
                this.geoCache.delete(key);
            }
        }
    }

    // Get security statistics
    getSecurityStats() {
        return {
            suspiciousActivities: this.suspiciousActivities.size,
            trackedIPs: new Set(Array.from(this.suspiciousActivities.values()).map(a => a.ipAddress)).size,
            geoTrackedUsers: this.geoCache.size,
            alertThresholds: this.alertThresholds
        };
    }
}

module.exports = SecurityHardening;