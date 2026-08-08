# Body Parser

> **Navigation :** [← plugins](plugins.md) | [security →](security.md)

Le body parser lit et transforme les données reçues par une requête.

## Ce qu’il gère

- JSON
- form-urlencoded
- multipart/form-data
- texte brut

## Pourquoi utilisé

- accéder facilement à `@Body()`
- traiter des fichiers envoyés par formulaire

## Comment l’utiliser

Le plugin est généralement activé automatiquement, mais vous pouvez le documenter comme partie du flux standard.

```typescript
app.register(bodyParserPlugin())
```

## Avantages

- rend les payloads utilisables directement dans les contrôleurs
- gère plusieurs formats courants

## Inconvénients

- le parsing multipart ajoute du coût
- il faut garder la taille des payloads sous contrôle

---

[← plugins](plugins.md) | [security →](security.md)
