
export type EncryptionResultType = string;

export interface DerivationOptionsInterface {
    // hex string; if not provided, a random 16-byte salt will be generated
    salt?: string;
    // for PBKDF2
    iterations?: number;
    // bytes length for derived key (default 64)
    keylen?: number;
    // for PBKDF2 digest (default 'sha512')
    digest?: string;
}

export interface ScryptOptionsInterface {
    // hex string; if not provided, a random 16-byte salt will be generated
    salt?: string;
    // bytes length for derived key (default 64)
    keylen?: number;
    // N parameter (default 16384)
    cost?: number;
    // r parameter (default 8)
    blockSize?: number;
    // p parameter (default 1)
    parallelization?: number;
}
