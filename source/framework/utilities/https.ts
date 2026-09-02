import fs from 'node:fs'
import os from 'node:os'
import {execSync, execFileSync} from 'node:child_process'
import path from 'node:path'

export enum HttpsEnvironment {
    Localhost = 'localhost',
    LAN = 'lan',
    Production = 'production',
}

export enum HttpsGenerator {
    OpenSSL = 'openssl',
    Mkcert = 'mkcert',
    None = 'none',
}

export interface HttpsCertificateConfig {
    cert: string
    key: string
    ca?: string
    passphrase?: string
}

export interface HttpsConfigInterface {
    enabled: boolean
    environment: HttpsEnvironment
    generator: HttpsGenerator
    autoGenerate: boolean
    port?: number
    certificate?: HttpsCertificateConfig
    certDir?: string
}

export interface HttpsDefinitionOptions {
    environment?: HttpsEnvironment
    generator?: HttpsGenerator
    autoGenerate?: boolean
    port?: number
    cert?: string
    key?: string
    ca?: string
    passphrase?: string
    certPath?: string
    keyPath?: string
    caPath?: string
    certDir?: string
}

// ── Helpers ────────────────────────────────────────────────────────

function ensureDirectorySync(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true})
    }
}

function readFileSyncSafe(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf-8')
    } catch {
        return undefined
    }
}

function resolveCertFromPaths(
    certPath?: string,
    keyPath?: string,
    caPath?: string,
): HttpsCertificateConfig | undefined {
    if (!certPath || !keyPath) return undefined
    const cert = readFileSyncSafe(certPath)
    const key = readFileSyncSafe(keyPath)
    const ca = caPath ? readFileSyncSafe(caPath) : undefined
    if (!cert || !key) return undefined
    return {cert, key, ca}
}

function getLanHostname(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return 'localhost'
}

function isCommandAvailable(command: string): boolean {
    try {
        execSync(
            process.platform === 'win32' ? `where ${command}` : `which ${command}`,
            {stdio: 'pipe'}
        )
        return true
    } catch {
        return false
    }
}

// ── Certificate generators ────────────────────────────────────────

function generateWithOpenSSL(domain: string, certDir: string): HttpsCertificateConfig {
    const keyPath = path.join(certDir, `${domain}.key`)
    const certPath = path.join(certDir, `${domain}.pem`)

    const existingKey = readFileSyncSafe(keyPath)
    const existingCert = readFileSyncSafe(certPath)
    if (existingKey && existingCert) {
        return {key: existingKey, cert: existingCert}
    }

    ensureDirectorySync(certDir)

    execSync(
        `openssl req -x509 -newkey rsa:2048 -nodes ` +
        `-keyout "${keyPath}" -out "${certPath}" ` +
        `-days 365 -subj "/CN=${domain}/O=Raiton Dev/C=US" ` +
        `-addext "subjectAltName=DNS:${domain},DNS:*.${domain},IP:127.0.0.1,IP:::1"`,
        {stdio: 'pipe'}
    )

    return {key: fs.readFileSync(keyPath, 'utf-8'), cert: fs.readFileSync(certPath, 'utf-8')}
}

function generateWithMkcert(domain: string, certDir: string): HttpsCertificateConfig {
    const keyPath = path.join(certDir, `${domain}.key`)
    const certPath = path.join(certDir, `${domain}.pem`)

    const existingKey = readFileSyncSafe(keyPath)
    const existingCert = readFileSyncSafe(certPath)
    if (existingKey && existingCert) {
        return {key: existingKey, cert: existingCert}
    }

    ensureDirectorySync(certDir)

    execSync(
        `mkcert -cert-file "${certPath}" -key-file "${keyPath}" ` +
        `-days 365 "${domain}" "*.${domain}"`,
        {stdio: 'pipe'}
    )

    return {key: fs.readFileSync(keyPath, 'utf-8'), cert: fs.readFileSync(certPath, 'utf-8')}
}

function autoGenerateCert(
    domain: string,
    generator: HttpsGenerator,
    certDir: string,
): HttpsCertificateConfig {
    if (generator === HttpsGenerator.Mkcert) {
        if (!isCommandAvailable('mkcert')) {
            throw new Error(
                '[Raiton HTTPS] mkcert is not installed. ' +
                'Install it (https://github.com/FiloSottile/mkcert) or switch generator to HttpsGenerator.OpenSSL.'
            )
        }
        return generateWithMkcert(domain, certDir)
    }

    if (generator === HttpsGenerator.OpenSSL) {
        if (!isCommandAvailable('openssl')) {
            throw new Error(
                '[Raiton HTTPS] openssl is not installed. ' +
                'Install it or switch generator to HttpsGenerator.Mkcert.'
            )
        }
        return generateWithOpenSSL(domain, certDir)
    }

    throw new Error(
        '[Raiton HTTPS] autoGenerate is enabled but generator is set to "none". ' +
        'Set generator to HttpsGenerator.OpenSSL or HttpsGenerator.Mkcert, or provide certificates explicitly.'
    )
}

// ── Core API ──────────────────────────────────────────────────────

export function defineHttps(options: HttpsDefinitionOptions = {}): HttpsConfigInterface {
    const environment = options.environment ?? HttpsEnvironment.Localhost
    const generator = options.generator ?? HttpsGenerator.OpenSSL
    const autoGenerate = options.autoGenerate ?? true
    const certDir = options.certDir ?? path.join(process.cwd(), '.raiton', 'certs')

    let certificate: HttpsCertificateConfig | undefined

    if (options.cert && options.key) {
        certificate = {
            cert: options.cert,
            key: options.key,
            ca: options.ca,
            passphrase: options.passphrase,
        }
    } else if (options.certPath && options.keyPath) {
        certificate = resolveCertFromPaths(options.certPath, options.keyPath, options.caPath)
    }

    if (!certificate) {
        if (environment === HttpsEnvironment.Production && !autoGenerate) {
            throw new Error(
                '[Raiton HTTPS] Production environment requires explicit certificate configuration. ' +
                'Use cert/key strings, certPath/keyPath, or enable autoGenerate.'
            )
        }

        if (autoGenerate && generator !== HttpsGenerator.None) {
            const domain = environment === HttpsEnvironment.LAN ? getLanHostname() : 'localhost'
            certificate = autoGenerateCert(domain, generator, certDir)
        }
    }

    return {
        enabled: true,
        environment,
        generator,
        autoGenerate,
        port: options.port,
        certificate,
        certDir,
    }
}

// ── Presets ───────────────────────────────────────────────────────

export function httpsLocalhost(options?: Omit<HttpsDefinitionOptions, 'environment'>): HttpsConfigInterface {
    return defineHttps({...options, environment: HttpsEnvironment.Localhost})
}

export function httpsLan(options?: Omit<HttpsDefinitionOptions, 'environment'>): HttpsConfigInterface {
    return defineHttps({...options, environment: HttpsEnvironment.LAN})
}

export function httpsProduction(options: Omit<HttpsDefinitionOptions, 'environment'> & {
    cert: string
    key: string
}): HttpsConfigInterface {
    return defineHttps({...options, environment: HttpsEnvironment.Production})
}

// ── Merge ─────────────────────────────────────────────────────────

export type HttpsConfigInput = HttpsConfigInterface | HttpsConfigInterface[]

export function resolveHttpsConfig(input: HttpsConfigInput | undefined): HttpsConfigInterface | undefined {
    if (!input) return undefined

    const configs = Array.isArray(input) ? input : [input]

    if (configs.length === 0) return undefined
    if (configs.length === 1) return configs[0]

    return mergeHttps(...configs)
}

export function mergeHttps(...configs: HttpsConfigInterface[]): HttpsConfigInterface {
    if (configs.length === 0) {
        throw new Error('[Raiton HTTPS] mergeHttps requires at least one configuration.')
    }

    if (configs.length === 1) return configs[0]

    const merged: HttpsConfigInterface = {
        ...configs[0],
    }

    for (let i = 1; i < configs.length; i++) {
        const next = configs[i]
        if (!next) continue

        merged.enabled = next.enabled
        merged.environment = next.environment
        merged.generator = next.generator
        merged.autoGenerate = next.autoGenerate

        if (next.port !== undefined) merged.port = next.port
        if (next.certDir !== undefined) merged.certDir = next.certDir
        if (next.certificate) merged.certificate = next.certificate
    }

    return merged
}
