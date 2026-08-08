# Runtime

> **Navigation :** [← api](api/README.md) | [env →](env.md)

Raiton peut s’exécuter sur plusieurs runtimes.
Le runtime choisi détermine la manière dont le serveur HTTP est créé et géré.

## Runtime recommandé

Le runtime principal du projet est Bun.

```typescript
import { RuntimeType } from "raiton/framework"

return await thread.setup({
  application: app,
  runtime: RuntimeType.Bun
}).run()
```

## Pourquoi utilisé

- choisir explicitement l’environnement d’exécution
- garder un point d’entrée unique pour Bun et Node

## Comment l’utiliser

- laissez Raiton détecter le runtime si vous ne souhaitez rien imposer
- forcez `RuntimeType.Bun` si vous ciblez Bun en priorité
- utilisez `RuntimeType.Node` si vous visez un exécutable Node

## Avantages

- abstraction claire
- intégration cohérente dans le bootstrap

## Inconvénients

- tous les runtimes n’ont pas le même niveau de maturité
- Bun est généralement le plus complet

---

[← api](api/README.md) | [env →](env.md)
