# Décorateurs de paramètres

> **Navigation :** [← routes](routes.md) | [injection →](injection.md)

Les décorateurs de paramètres permettent d’extraire les données de la requête dans les arguments d’une méthode.

## Décorateurs concernés

- `@Param()`
- `@Query()`
- `@Body()`
- `@Headers()`
- `@Reply()`
- `@Req()`
- `@Cookie()`
- `@UploadedFile()`

## Pourquoi utilisé

- éviter de manipuler la requête à la main
- rendre les signatures de méthode plus claires
- cibler directement la source de données voulue

## Comment l’utiliser

- décorez chaque argument avec la source attendue
- fournissez une clé quand vous ciblez une valeur précise
- gardez `@Reply()` et `@Req()` pour les besoins bas niveau

## Exemple

```typescript
import { Controllable, Get, Param, Query } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/:id")
  getOne(@Param("id") id: string, @Query("verbose") verbose?: string) {
    return { id, verbose }
  }
}
```

## Avantages

- code expressif
- extraction ciblée
- moins de logique répétitive dans les handlers

## Inconvénients

- peut fragmenter la signature si on en abuse
- dépend du métadonnées `design:paramtypes`

---

[← routes](routes.md) | [injection →](injection.md)
