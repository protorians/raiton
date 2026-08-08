# Chiffrement

> **Navigation :** [← env](env.md) | [injection →](injection.md)

La classe `Encryption` permet de hasher des données et de vérifier des mots de passe.

## Exemple

```typescript
import { Encryption, HashAlgoEnum } from "raiton/framework"

const hasher = new Encryption(HashAlgoEnum.ARGON2ID)
const hash = await hasher.make("secret")
const valid = await hasher.checkPassword(hash as string, "secret")
```

## Pourquoi utilisé

- stocker des secrets de façon sûre
- comparer des mots de passe
- dériver des clés

## Comment l’utiliser

- utilisez `ARGON2ID` pour les mots de passe
- utilisez `SHA256` ou `SHA512` pour des valeurs déterministes

## Avantages

- plusieurs algorithmes dans une seule API
- prise en charge de `argon2` et `bcrypt`

## Inconvénients

- certains algorithmes sont plus lourds que d’autres
- le choix de l’algorithme doit être cohérent avec le cas d’usage

---

[← env](env.md) | [injection →](injection.md)
