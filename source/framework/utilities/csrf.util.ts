import crypto from "node:crypto";
import {CsrfTokenPayload} from "../../types";

const DEFAULT_TTL = 3600_000

export class CsrfUtil {

    static generateDoubleSubmitToken(secret: string): string {
        const timestamp = Date.now().toString(36)
        const nonce = crypto.randomBytes(16).toString('hex')
        const payload = `${timestamp}.${nonce}`
        const signature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex')
        return `${payload}.${signature}`
    }

    static validateDoubleSubmitToken(secret: string, token: string, maxAge?: number): boolean {
        if (!token || typeof token !== 'string') return false

        const parts = token.split('.')
        if (parts.length !== 3) return false

        const [timestampB36, nonce, signature] = parts
        const payload = `${timestampB36}.${nonce}`

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex')

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return false
        }

        if (maxAge !== undefined) {
            const timestamp = parseInt(timestampB36, 36)
            if (isNaN(timestamp)) return false
            if (Date.now() - timestamp > maxAge) return false
        }

        return true
    }

    static generateSynchronizerToken(): string {
        return crypto.randomBytes(32).toString('hex')
    }

    static createTokenStore(ttl: number = DEFAULT_TTL) {
        const store = new Map<string, CsrfTokenPayload>()

        const cleanup = () => {
            const now = Date.now()
            for (const [key, entry] of store) {
                if (now > entry.expiresAt) {
                    store.delete(key)
                }
            }
        }

        const interval = setInterval(cleanup, Math.min(ttl, 60_000))
        if (typeof interval === 'object' && 'unref' in interval) {
            interval.unref()
        }

        return {
            create(): string {
                const token = CsrfUtil.generateSynchronizerToken()
                store.set(token, {
                    token,
                    expiresAt: Date.now() + ttl
                })
                return token
            },

            validate(token: string): boolean {
                if (!token || typeof token !== 'string') return false
                const entry = store.get(token)
                if (!entry) return false
                if (Date.now() > entry.expiresAt) {
                    store.delete(token)
                    return false
                }
                return true
            },

            revoke(token: string): boolean {
                return store.delete(token)
            },

            get size(): number {
                return store.size
            },

            destroy(): void {
                clearInterval(interval)
                store.clear()
            }
        }
    }

    static isBrowserClient(headers: Headers, config?: {
        headerName?: string
        skipClients?: string[]
    }): boolean {
        const clientTypeHeader = config?.headerName ?? 'X-Client-Type'
        const skipClients = config?.skipClients ?? ['mobile', 'desktop']

        const clientType = headers.get(clientTypeHeader)
        if (clientType && skipClients.includes(clientType.toLowerCase())) {
            return false
        }

        const authorization = headers.get('authorization')
        const hasCookie = headers.get('cookie')?.includes('_csrf') ?? false

        if (authorization && !hasCookie) {
            return false
        }

        return true
    }

    static serializeCookie(name: string, value: string, options?: {
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'strict' | 'lax' | 'none'
        path?: string
        domain?: string
        maxAge?: number
    }): string {
        let cookie = `${name}=${value}`

        if (options?.httpOnly) cookie += '; HttpOnly'
        if (options?.secure) cookie += '; Secure'
        if (options?.sameSite) {
            cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`
        }
        if (options?.path) cookie += `; Path=${options.path}`
        if (options?.domain) cookie += `; Domain=${options.domain}`
        if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`

        return cookie
    }
}
