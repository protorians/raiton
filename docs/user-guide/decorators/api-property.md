# `@ApiProperty()`

> **Navigation :** [← api-param](api-param.md) | [api-query →](api-query.md)

`@ApiProperty()` décrit une propriété de DTO pour OpenAPI.

## Pourquoi utilisé

- documenter les objets renvoyés ou reçus
- enrichir les schémas générés
- fournir des exemples et des contraintes visibles dans la doc

## Comment l’utiliser

- placez le décorateur sur les propriétés d’une classe DTO
- précisez le type, une description, un exemple ou un tableau
- utilisez-le surtout sur les objets exposés dans l’API publique

## Exemple

```typescript
import { ApiProperty } from "raiton/framework"

class UserDto {
  @ApiProperty({ example: "1" })
  id: string

  @ApiProperty({ example: "John Doe" })
  name: string
}
```

## Avantages

- schémas plus clairs
- bon support des DTOs
- rend la documentation utile pour le consommateur

## Inconvénients

- nécessite de maintenir la description des champs
- peut être superflu sur les objets purement internes

---

[← api-param](api-param.md) | [api-query →](api-query.md)
