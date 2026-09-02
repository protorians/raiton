# Sécurité

> **Navigation :** [← body-parser](body-parser.md) | [https →](https.md)

Les plugins de sécurité servent à protéger une API exposée publiquement.

## Briques disponibles

- `Security.headers()`
- `Security.cors()`
- `Security.rateLimit()`
- `Security.bodyLimit()`
- `Security.methodGuard()`

## Exemple

```typescript
app.register({
  plugins: [
    Security.headers(),
    Security.cors({ origin: "*" }),
    Security.rateLimit({ max: 100, windowMs: 60000 }),
    Security.bodyLimit(1_000_000)
  ]
})
```

## Pourquoi utilisé

- réduire les abus
- contrôler les origines autorisées
- limiter la taille des payloads

## Avantages

- facile à activer
- couvre plusieurs protections de base

## Inconvénients

- `rateLimit()` est en mémoire, donc non distribué
- `cors()` doit être configuré selon le contexte réel

---

[← body-parser](body-parser.md) | [https →](https.md)
