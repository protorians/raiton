# Recette — observabilité

**Objectif** : corréler, mesurer et arrêter proprement.

```bash
RAITON_OBSERVABILITY=all raiton dev
curl -i -H 'x-request-id: req-123' http://localhost:5711/api/health
curl http://localhost:5711/api/metrics
```

**Attendu**

- réponse contenant `x-request-id: req-123` ;
- métriques Prometheus `http_requests_total` et `http_request_duration_seconds` ;
- à l'arrêt, `/health` retourne `503` immédiatement, les requêtes en cours sont drainées puis le processus sort en `0`.

**Budget** : `off` = 0 surcoût mesurable ; `metrics` ≤ 5 % p50 ; `traces` ≤ 10 % p50.
