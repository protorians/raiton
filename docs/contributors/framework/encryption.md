# Encryption

**Fichier :** `source/framework/encryption.ts`
**Import :** `import { Encryption, HashAlgoEnum, PasswordAlgoEnum, CipherAlgoEnum } from "raiton/framework"`

> **Navigation :** [← responses.md](responses.md) | [↑ framework/](README.md) | [env.md →](env.md)

Classe de hachage et chiffrement supportant multiples algorithmes.

## Constructeur

```typescript
const encrypt = new Encryption(HashAlgoEnum.SHA256)
const encrypt = new Encryption(HashAlgoEnum.ARGON2ID)
```

## Algorithmes supportés

### Hachage simple (HashAlgoEnum)

| Algorithme | Description | Retour |
|-----------|-------------|--------|
| `SHA256` | SHA-2 256 bits | Hex string |
| `SHA512` | SHA-2 512 bits | Hex string |
| `MD5` | MD5 (128 bits) | Hex string |
| `RIPEMD160` | RIPEMD-160 | Hex string |
| `BLAKE2B` | BLAKE2b-512 | Hex string |
| `SHA3_256` | SHA-3 256 bits | Hex string |
| `SHA3_512` | SHA-3 512 bits | Hex string |

### Dérivation de clé

| Algorithme | Description | Retour |
|-----------|-------------|--------|
| `PBKDF2` | Password-Based Key Derivation Function 2 | Format `pbkdf2$digest$iterations$salt$hash` |
| `SCRYPT` | Algorithme scrypt | Format `scrypt$N$r$p$salt$hash` |

### Mots de passe

| Algorithme | Description | Dépendance |
|-----------|-------------|-----------|
| `ARGON2ID` | Argon2id (recommandé) | `argon2` |
| `BCRYPT` | bcrypt | `bcrypt` |

## Méthodes

### `make(value, options?)`

Hache une valeur selon l'algorithme choisi.

```typescript
// SHA256
const sha256 = new Encryption(HashAlgoEnum.SHA256)
await sha256.make("mon-mot-de-passe")
// → "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5"

// PBKDF2 avec options personnalisées
const pbkdf2 = new Encryption(HashAlgoEnum.PBKDF2)
await pbkdf2.make("secret", {
  salt: "monsel",
  iterations: 100_000,
  keylen: 64,
  digest: "sha512",
})
// → "pbkdf2$sha512$100000$monsel$..."

// Argon2id (recommandé pour mots de passe)
const argon = new Encryption(HashAlgoEnum.ARGON2ID)
await argon.make("mon-mot-de-passe")
// → "$argon2id$v=19$m=65536,t=3,p=4$..."

// bcrypt
const bcrypt = new Encryption(HashAlgoEnum.BCRYPT)
await bcrypt.make("mon-mot-de-passe")
// → "$2b$12$..."
```

### `compare(value, hash)`

Compare une valeur avec un hash (pour les algorithmes déterministes comme SHA).

```typescript
const sha256 = new Encryption(HashAlgoEnum.SHA256)
const hash = await sha256.make("secret")
const match = await sha256.compare("secret", hash)
// → true
```

### `checkPassword(hash, password)`

Vérifie un mot de passe contre un hash argon2 ou bcrypt.

```typescript
const argon = new Encryption(HashAlgoEnum.ARGON2ID)
const hash = await argon.make("mon-mot-de-passe")

const valid = await argon.checkPassword(hash, "mon-mot-de-passe")
// → true

const invalid = await argon.checkPassword(hash, "mauvais")
// → false
```

### `password(value, options?)`

Hache un mot de passe avec argon2 ou bcrypt spécifiquement.

```typescript
const encrypt = new Encryption(HashAlgoEnum.ARGON2ID)

// Argon2 avec options
await encrypt.password("secret", {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 2,
})

// bcrypt avec salt rounds spécifique
const encryptBcrypt = new Encryption(HashAlgoEnum.BCRYPT)
await encryptBcrypt.password("secret", 10)  // 10 rounds
```

### `randomAlgo(algo?)`

Sélectionne un algorithme aléatoire parmi une liste.

```typescript
const randomHash = Encryption.randomAlgo()
// → SHA256 ou SHA512 ou MD5...

const passwordHash = Encryption.randomAlgo([
  PasswordAlgoEnum.BCRYPT,
  PasswordAlgoEnum.ARGON2ID,
])
```

## Exemple complet

```typescript
import { Encryption, HashAlgoEnum } from "raiton/framework"

async function exemple() {
  // 1. Hachage SHA256
  const sha = new Encryption(HashAlgoEnum.SHA256)
  const hash = await sha.make("données sensibles")
  console.log(hash) // hex string

  // 2. Hash de mot de passe avec argon2 (recommandé)
  const passwordHash = new Encryption(HashAlgoEnum.ARGON2ID)
  const pwd = await passwordHash.make("mon-mot-de-passe")

  // 3. Vérification
  const ok = await passwordHash.checkPassword(pwd, "mon-mot-de-passe")
  console.log(ok) // true
}
```

## Utilisation dans un service

```typescript
@Injectable(LifetimeEnum.SINGLETON)
class AuthService {
  private encrypt = new Encryption(HashAlgoEnum.ARGON2ID)

  async hashPassword(password: string): Promise<string> {
    return await this.encrypt.make(password)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await this.encrypt.checkPassword(hash, password)
  }

  generateApiKey(): string {
    const sha = new Encryption(HashAlgoEnum.SHA256)
    return sha.make(crypto.randomUUID())
  }
}

---

[← responses.md](responses.md) | [↑ framework/](README.md) | [env.md →](env.md)
```
