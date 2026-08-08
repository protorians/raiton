# `@Guard()`

> **Navigation :** [← route-interaction](route-interaction.md) | [README →](README.md)

`@Guard()` branche une garde d’accès sur une route ou un contrôleur via le mécanisme de middleware interne du framework.

## Pourquoi utilisé

- protéger une ressource
- centraliser une vérification d’accès
- renvoyer un `403 Forbidden` quand la condition échoue

## Comment l’utiliser

- définissez une garde nommée
- placez le décorateur sur la classe ou la méthode concernée
- laissez la garde décider si la requête peut continuer

## Exemple

```typescript
import { Controllable, Get, Guard } from "raiton/framework"

@Controllable("/admin")
export class AdminController {
  @Get("/")
  @Guard({
    name: "admin-only",
    handler: async ({ context, next }) => {
      const role = context.state.user?.role
      if (role === "admin") {
        await next()
        return true
      }
      return false
    }
  })
  dashboard() {
    return { ok: true }
  }
}
```

## Avantages

- protection lisible
- logique d’accès réutilisable
- s’intègre au flux middleware

## Inconvénients

- ajoute une abstraction de plus autour de la sécurité
- dépend de conventions internes au framework

---

[← route-interaction](route-interaction.md) | [README →](README.md)
