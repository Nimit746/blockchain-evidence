/**
 * Hybrid RBAC/ABAC Policy Engine
 * Implements attribute-based access control with role-based policies
 */

class PolicyEngine {
    constructor() {
        this.policies = new Map();
        this.attributeProviders = new Map();
        this.init();
    }

    init() {
        // Register default attribute providers
        this.registerAttributeProvider('time', this.getTimeAttributes);
        this.registerAttributeProvider('location', this.getLocationAttributes);
        this.registerAttributeProvider('device', this.getDeviceAttributes);
        this.registerAttributeProvider('jurisdiction', this.getJurisdictionAttributes);
    }

    registerAttributeProvider(name, provider) {
        this.attributeProviders.set(name, provider);
    }

    async evaluatePolicy(user, resource, action, context = {}) {
        const attributes = await this.gatherAttributes(user, resource, context);
        const applicablePolicies = this.findApplicablePolicies(user.role, resource.type, action);
        
        for (const policy of applicablePolicies) {
            const result = await this.evaluatePolicyRule(policy, attributes);
            if (result.decision === 'DENY') {
                return { allowed: false, reason: result.reason, policy: policy.id };
            }
        }
        
        return { allowed: true, attributes };
    }

    async gatherAttributes(user, resource, context) {
        const attributes = {
            user: {
                id: user.id,
                role: user.role,
                department: user.department,
                jurisdiction: user.jurisdiction,
                clearanceLevel: user.clearanceLevel
            },
            resource: {
                id: resource.id,
                type: resource.type,
                sensitivity: resource.sensitivity,
                jurisdiction: resource.jurisdiction,
                caseType: resource.caseType
            },
            environment: {
                timestamp: new Date(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                location: context.location
            }
        };

        // Gather dynamic attributes
        for (const [name, provider] of this.attributeProviders) {
            try {
                attributes[name] = await provider(user, resource, context);
            } catch (error) {
                console.warn(`Failed to gather ${name} attributes:`, error);
            }
        }

        return attributes;
    }

    findApplicablePolicies(role, resourceType, action) {
        return Array.from(this.policies.values()).filter(policy => 
            policy.applies(role, resourceType, action)
        );
    }

    async evaluatePolicyRule(policy, attributes) {
        try {
            return await policy.evaluate(attributes);
        } catch (error) {
            console.error('Policy evaluation error:', error);
            return { decision: 'DENY', reason: 'Policy evaluation failed' };
        }
    }

    // Attribute providers
    getTimeAttributes = (user, resource, context) => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        return {
            currentHour: hour,
            isWorkingHours: hour >= 8 && hour <= 18,
            isWeekend: day === 0 || day === 6,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    };

    getLocationAttributes = (user, resource, context) => {
        return {
            ipAddress: context.ipAddress,
            country: context.country,
            region: context.region,
            isVPN: context.isVPN || false
        };
    };

    getDeviceAttributes = (user, resource, context) => {
        return {
            userAgent: context.userAgent,
            deviceType: this.detectDeviceType(context.userAgent),
            isTrustedDevice: this.isTrustedDevice(user.id, context.deviceFingerprint)
        };
    };

    getJurisdictionAttributes = (user, resource, context) => {
        return {
            userJurisdiction: user.jurisdiction,
            resourceJurisdiction: resource.jurisdiction,
            crossJurisdiction: user.jurisdiction !== resource.jurisdiction
        };
    };

    detectDeviceType(userAgent) {
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
        if (/Tablet/.test(userAgent)) return 'tablet';
        return 'desktop';
    }

    isTrustedDevice(userId, deviceFingerprint) {
        // Implementation would check against trusted device database
        return false; // Default to untrusted
    }

    // Policy management
    addPolicy(policy) {
        this.policies.set(policy.id, policy);
    }

    removePolicy(policyId) {
        this.policies.delete(policyId);
    }

    getPolicies() {
        return Array.from(this.policies.values());
    }
}

class Policy {
    constructor(id, name, rules, conditions = {}) {
        this.id = id;
        this.name = name;
        this.rules = rules;
        this.conditions = conditions;
    }

    applies(role, resourceType, action) {
        if (this.conditions.roles && !this.conditions.roles.includes(role)) return false;
        if (this.conditions.resourceTypes && !this.conditions.resourceTypes.includes(resourceType)) return false;
        if (this.conditions.actions && !this.conditions.actions.includes(action)) return false;
        return true;
    }

    async evaluate(attributes) {
        for (const rule of this.rules) {
            const result = await this.evaluateRule(rule, attributes);
            if (result.decision === 'DENY') {
                return result;
            }
        }
        return { decision: 'ALLOW' };
    }

    async evaluateRule(rule, attributes) {
        try {
            const result = await rule.evaluate(attributes);
            return result;
        } catch (error) {
            return { decision: 'DENY', reason: `Rule evaluation failed: ${error.message}` };
        }
    }
}

// Example policy rules
class TimeBasedRule {
    constructor(allowedHours = [8, 18]) {
        this.allowedHours = allowedHours;
    }

    async evaluate(attributes) {
        const currentHour = attributes.time?.currentHour;
        if (currentHour < this.allowedHours[0] || currentHour > this.allowedHours[1]) {
            return { 
                decision: 'DENY', 
                reason: `Access denied outside working hours (${this.allowedHours[0]}-${this.allowedHours[1]})` 
            };
        }
        return { decision: 'ALLOW' };
    }
}

class JurisdictionRule {
    async evaluate(attributes) {
        const userJurisdiction = attributes.user?.jurisdiction;
        const resourceJurisdiction = attributes.resource?.jurisdiction;
        
        if (userJurisdiction !== resourceJurisdiction) {
            return { 
                decision: 'DENY', 
                reason: 'Cross-jurisdiction access not permitted' 
            };
        }
        return { decision: 'ALLOW' };
    }
}

class IPWhitelistRule {
    constructor(allowedIPs = []) {
        this.allowedIPs = allowedIPs;
    }

    async evaluate(attributes) {
        const ipAddress = attributes.environment?.ipAddress;
        if (!this.allowedIPs.includes(ipAddress)) {
            return { 
                decision: 'DENY', 
                reason: 'IP address not in whitelist' 
            };
        }
        return { decision: 'ALLOW' };
    }
}

module.exports = { PolicyEngine, Policy, TimeBasedRule, JurisdictionRule, IPWhitelistRule };