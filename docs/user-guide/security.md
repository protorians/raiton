# Sécurité

> **Navigation :** [← body-parser](body-parser.md) | [csrf →](csrf.md)

Les plugins de sécurité servent à protéger une API exposée publiquement.

## Briques disponibles

- `Security.headers()`
- `Security.cors()`
- `Security.csrf()` — [Documentation complète](csrf.md)
- `Security.rateLimit()`
- `Security.bodyLimit()`
- `Security.methodGuard()`

## Exemple

```typescript
app.register({
  plugins: [
    Security.headers(),
    Security.cors({ origin: "*" }),
    Security.csrf({ mode: CSRFModeEnum.DOUBLE_SUBMIT, secret: process.env.CSRF_SECRET }),
    Security.rateLimit({ max: 100, windowMs: 60000 }),
    Security.bodyLimit(1_000_000)
  ]
})
```

## Pourquoi utilisé

- réduire les abus
- contrôler les origines autorisées
- limiter la taille des payloads
- protéger contre les attaques CSRF (Cross-Site Request Forgery)

## Avantages

- facile à activer
- couvre plusieurs protections de base
- CSRF supporte le mode stateless (double-submit) et stateful (synchronizer)
- détection automatique des clients mobile/desktop

## Inconvénients

- `rateLimit()` est en mémoire, donc non distribué
- `cors()` doit être configuré selon le contexte réel
- `csrf()` nécessite une configuration côté client pour les navigateurs

---

[← body-parser](body-parser.md) | [csrf →](csrf.md)
