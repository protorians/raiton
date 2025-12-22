
import crypto from "node:crypto";
import argon2, {Options} from "argon2";
import {HashAlgoEnum} from "./enums";
import bcrypt from "bcrypt";
import {IDerivationOptions, IEncryptionResult, IScryptOptions} from "@/types";

export class Encryption {
    static get algos() {
        return HashAlgoEnum;
    }

    static randomAlgo() {
        return Object.values(this.algos)[
            Math.floor(Math.random() * Object.values(this.algos).length)
            ];
    }

    constructor(public readonly algo: HashAlgoEnum) {
        if (!Object.values(HashAlgoEnum).includes(this.algo)) {
            throw new Error(`Invalid hash algorithm: ${this.algo}`);
        }
    }

    async make(value: string, options?: IDerivationOptions | IScryptOptions): Promise<IEncryptionResult> {
        if (!value) {
            throw new Error('Value cannot be empty');
        }

        switch (this.algo) {
            case HashAlgoEnum.SHA256:
                return this.sha256(value);
            case HashAlgoEnum.SHA512:
                return this.sha512(value);
            case HashAlgoEnum.MD5:
                return this.md5(value);
            case HashAlgoEnum.RIPEMD160:
                return this.ripemd160(value);
            case HashAlgoEnum.BLAKE2B:
                return this.blake2b(value);
            case HashAlgoEnum.SHA3_256:
                return this.sha3_256(value);
            case HashAlgoEnum.SHA3_512:
                return this.sha3_512(value);
            case HashAlgoEnum.PBKDF2:
                return this.pbkdf2(value, options as IDerivationOptions | undefined);
            case HashAlgoEnum.SCRYPT:
                return this.scrypt(value, options as IScryptOptions | undefined);
            case HashAlgoEnum.ARGON2ID:
            case HashAlgoEnum.BCRYPT:
                return this.password(value);
            default:
                throw new Error(`Unsupported algorithm: ${this.algo}`);
        }
    }

    protected sha256(value: string): IEncryptionResult {
        return crypto.createHash("sha256").update(value).digest("hex");
    }

    protected sha512(value: string): IEncryptionResult {
        return crypto.createHash("sha512").update(value).digest("hex");
    }

    protected md5(value: string): IEncryptionResult {
        return crypto.createHash("md5").update(value).digest("hex");
    }

    protected ripemd160(value: string): IEncryptionResult {
        return crypto.createHash("ripemd160").update(value).digest("hex");
    }

    protected blake2b(value: string): IEncryptionResult {
        return crypto.createHash("blake2b512").update(value).digest("hex");
    }

    protected sha3_256(value: string): IEncryptionResult {
        return crypto.createHash("sha3-256").update(value).digest("hex");
    }

    protected sha3_512(value: string): IEncryptionResult {
        return crypto.createHash("sha3-512").update(value).digest("hex");
    }

    protected pbkdf2(value: string, options?: IDerivationOptions): IEncryptionResult {
        const {salt, iterations, keylen, digest} = options || {};
        const usedSalt = salt ?? crypto.randomBytes(16).toString("hex");
        const usedIterations = iterations ?? 100_000;
        const usedKeylen = keylen ?? 64;
        const usedDigest = digest ?? "sha512";
        const derived = crypto
            .pbkdf2Sync(value, Buffer.from(usedSalt, "hex"), usedIterations, usedKeylen, usedDigest)
            .toString("hex");
        return `pbkdf2$${usedDigest}$${usedIterations}$${usedSalt}$${derived}`;
    }

    protected scrypt(value: string, options?: IScryptOptions): IEncryptionResult {
        const {salt, keylen, cost, blockSize, parallelization} = options || {} as IScryptOptions;
        const usedSalt = salt ?? crypto.randomBytes(16).toString("hex");
        const usedKeylen = keylen ?? 64;
        const usedCost = cost ?? 16384; // N
        const usedBlockSize = blockSize ?? 8; // r
        const usedParallel = parallelization ?? 1; // p
        const derived = crypto
            .scryptSync(value, Buffer.from(usedSalt, "hex"), usedKeylen, {
                N: usedCost,
                r: usedBlockSize,
                p: usedParallel,
                maxmem: 32 * 1024 * 1024,
            })
            .toString("hex");
        return `scrypt$${usedCost}$${usedBlockSize}$${usedParallel}$${usedSalt}$${derived}`;
    }

    protected unsupported(): never {
        throw new Error(`${this.algo} not supported without optional dependency`);
    }

    async password(value: string, options?: (Options & {
        raw?: boolean
    }) | (string | number) | undefined): Promise<IEncryptionResult> {
        switch (this.algo) {
            case HashAlgoEnum.ARGON2ID: {
                return await argon2.hash(value, {
                    ...(typeof options === 'object' ? options : {}),
                    type: argon2.argon2id
                });
            }
            case HashAlgoEnum.BCRYPT: {
                try {
                    const saltRounds = 12;
                    return await bcrypt.hash(
                        value,
                        (typeof options === 'string' || typeof options === 'number') ? options : saltRounds
                    );
                } catch (e) {
                    throw new Error(`BCRYPT not supported without optional dependency "bcrypt"`);
                }
            }
            default:
                throw new Error(`password() is only available for BCRYPT and ARGON2ID (current: ${this.algo})`);
        }
    }

    async checkPassword(hash: string, password: string): Promise<boolean> {
        switch (this.algo) {
            case HashAlgoEnum.ARGON2ID:
                return await argon2.verify(hash, password);
            case HashAlgoEnum.BCRYPT:
                return await bcrypt.compare(password, hash);
        }
        return false;
    }

}