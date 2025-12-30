
export type IEncryptionResult = string;

export interface IDerivationOptions {
    salt?: string; // hex string; if not provided, a random 16-byte salt will be generated
    iterations?: number; // for PBKDF2
    keylen?: number; // bytes length for derived key (default 64)
    digest?: string; // for PBKDF2 digest (default 'sha512')
}

export interface IScryptOptions {
    salt?: string; // hex string; if not provided, a random 16-byte salt will be generated
    keylen?: number; // bytes length for derived key (default 64)
    cost?: number; // N parameter (default 16384)
    blockSize?: number; // r parameter (default 8)
    parallelization?: number; // p parameter (default 1)
}
