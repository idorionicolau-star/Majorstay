/**
 * Input Validation Utilities
 * Protection against injection attacks and malformed data
 */

/**
 * Sanitize string input to prevent NoSQL injection
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
        throw new Error('Invalid input: expected string');
    }

    // Trim and limit length
    const trimmed = input.trim().substring(0, maxLength);

    // Remove null bytes and other control characters
    return trimmed.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validate companyId format (Firestore document ID)
 */
export function validateCompanyId(companyId: unknown): string {
    if (typeof companyId !== 'string' || !companyId) {
        throw new Error('Invalid companyId: must be a non-empty string');
    }

    // Firestore document IDs are alphanumeric + some special chars
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) {
        throw new Error('Invalid companyId format');
    }

    return companyId;
}

/**
 * Validate email format
 */
export function validateEmail(email: unknown): string {
    if (typeof email !== 'string' || !email) {
        throw new Error('Invalid email: must be a non-empty string');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }

    return email.toLowerCase().substring(0, 254); // RFC 5321
}

/**
 * Validate and sanitize object to prevent prototype pollution
 */
export function sanitizeObject<T extends Record<string, any>>(obj: unknown): T {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error('Invalid input: expected object');
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }

        // Sanitize strings
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
        } else if (value === null) {
            sanitized[key] = null;
        } else if (Array.isArray(value)) {
            sanitized[key] = value;
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        }
    }

    return sanitized as T;
}

/**
 * Rate limiting check (basic in-memory implementation)
 * For production, use Redis or a dedicated service
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = requestCounts.get(identifier);

    if (!record || now > record.resetAt) {
        requestCounts.set(identifier, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * Validate AI prompt input
 */
export function validateAIPrompt(prompt: unknown): string {
    if (typeof prompt !== 'string' || !prompt) {
        throw new Error('Invalid prompt: must be a non-empty string');
    }

    const trimmed = prompt.trim();

    // Limit length to prevent token exhaustion attacks
    if (trimmed.length > 5000) {
        throw new Error('Prompt too long: maximum 5000 characters');
    }

    if (trimmed.length < 1) {
        throw new Error('Prompt too short: minimum 1 character');
    }

    return trimmed;
}
