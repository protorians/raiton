# Configuration

> **Navigation :** [← getting-started](getting-started.md) | [architecture →](architecture.md)

Le fichier `raiton.config.ts` décrit la racine du projet et quelques options globales.

## Pourquoi utilisé

- définir le `rootDir`
- centraliser les valeurs de base de l’application
- garder le bootstrap propre

## Exemple

```typescript
export default {
  rootDir: "./source",
  version: "0.10.0",
  port: 5711,
  hostname: "0.0.0.0",
  protocole: "http",
  pathname: "/",
  artifacts: {
    types: ["controller", "socket", "service"]
  }
}
```

## Chargement et validation

Ordre de chargement documenté :

```text
raiton.config.ts → .mts → .cts → .js → .mjs → .cjs → .json
```

La configuration est validée **avant l’ouverture du port**. Une valeur
invalide produit des erreurs par champ et empêche l’écoute. Le schéma JSON
publié est disponible dans `docs/generated/config-schema.json` ou via
`raiton inspect --config-schema`.

## Comment l’utiliser

- placez le fichier à la racine du projet
- gardez `source/main.ts` comme point d’entrée applicatif
- ajustez `rootDir` si votre code source n’est pas dans `source/`
- utilisez `defineConfigSync` pour le typage et la validation à la définition

## Avantages

- configuration lisible
- séparation claire entre code et runtime

## Inconvénients

- le projet doit suivre une convention de chargement
- les options doivent rester cohérentes avec le bootstrap

---

[← getting-started](getting-started.md) | [architecture →](architecture.md)
