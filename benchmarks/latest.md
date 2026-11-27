# Raiton performance benchmark

Généré le 2026-11-27T18:55:33.691Z · Bun 1.4.2 · darwin-x64

Mémoire : **114.9 Mo RSS** · **11.5 Mo heap**

### Routage (µs / requête)

| Scénario | p50 | p90 |
|---|---|---|
| Cible en premier (300 routes) | 0.223 | 0.313 |
| Cible au milieu (300 routes) | 0.227 | 0.235 |
| Cible en dernier (300 routes) | 0.233 | 0.250 |
| Paramétrique /res299/:id | 0.584 | 0.647 |
| 100 routes statiques | 0.252 | 0.276 |
| 1 000 routes statiques | 0.248 | 0.311 |

Ratio ordre (dernier / premier) : **1.05×** · ratio échelle (1 000 / 100) : **0.98×**

### Pile HTTP complète (µs / requête)

| Scénario | p50 | p90 | req/s |
|---|---|---|---|
| 0 route + cible | 3.569 | 6.929 | 209116 |
| 100 routes, cible en premier | 2.808 | 4.665 | 277381 |
| 100 routes, cible en dernier | 2.442 | 3.535 | 315388 |
| 300 routes, cible en premier | 2.459 | 3.844 | 308106 |
| 300 routes, cible en dernier | 2.318 | 3.637 | 327383 |

### Validation de réponse (µs / requête)

| Scénario | p50 | p90 |
|---|---|---|
| Développement (validation active) | 42.087 | 61.026 |
| Production (validation désactivée) | 3.193 | 5.705 |

### Body parser (µs / requête)

| Scénario | p50 | p90 | Octets |
|---|---|---|---|
| Lecture native JSON 547 octets | 0.838 | 3.438 | 534 |
| POST JSON 547 octets (pile complète) | 8.317 | 17.174 | 518 |
| POST JSON 10 Ko (pile complète) | 10.566 | 20.652 | 9984 |

### Démarrage à froid (ms)

| Entrée | p50 |
|---|---|
| Import framework | 53.9 |
| Import decorators | 18.3 |

### HMR et classification

| Scénario | p50 | p90 |
|---|---|---|
| Reload contrôleur 3 routes (ms) | 0.370 | 0.556 |
| Classification 5 000 fichiers (ms) | 1.455 | 1.564 |

### Observabilité

| Mode | p50 (µs) | Surcoût p50 |
|---|---|---|
| off | 2.438 | 0.00 % |
| metrics | 6.976 | 186.14 % |
| traces | 7.464 | 206.15 % |

