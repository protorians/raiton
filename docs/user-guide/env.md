# Variables d’environnement

> **Navigation :** [← runtime](runtime.md) | [encryption →](encryption.md)

Les variables d’environnement servent à configurer l’application sans modifier le code.

## Exemple

```typescript
import { env } from "raiton/framework"

const port = env<number>("PORT", 5711, "int")
const host = env("HOST", "0.0.0.0")
const debug = env<boolean>("DEBUG", false, "boolean")
```

## Pourquoi utilisé

- isoler les secrets et les paramètres d’exécution
- éviter les valeurs codées en dur

## Comment l’utiliser

- utilisez `env()` pour lire une valeur simple
- utilisez `envGroup()` si vous voulez regrouper des variables par préfixe

## Avantages

- simple
- compatible avec les pratiques classiques `.env`

## Inconvénients

- la conversion booléenne reste basique
- il faut rester attentif aux valeurs manquantes

---

[← runtime](runtime.md) | [encryption →](encryption.md)
