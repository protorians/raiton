import {CSRFModeEnum} from "../framework/enums";

export interface CsrfClientDetectionConfig {
    headerName?: string
    skipClients?: string[]
}

export interface CsrfOptions {
    mode?: CSRFModeEnum
    secret?: string
    cookieName?: string
    headerName?: string
    ttl?: number
    methods?: string[]
    skip?: string[]
    client?: CsrfClientDetectionConfig
    cookieOptions?: CsrfCookieOptions
}

export interface CsrfCookieOptions {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    path?: string
    domain?: string
    maxAge?: number
}

export interface CsrfTokenPayload {
    token: string
    expiresAt: number
}

export interface CsrfGuardOptions {
    mode?: CSRFModeEnum
    methods?: string[]
    skipPaths?: string[]
}
