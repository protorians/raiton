# Raiton performance benchmark

Généré le 2026-11-27T02:02:20.107Z · Bun 1.4.2 · darwin-x64

Mémoire : **102.4 Mo RSS** · **9.7 Mo heap**

### Routage (µs / requête)

| Scénario | p50 | p90 |
|---|---|---|
| Cible en premier (300 routes) | 0.223 | 0.302 |
| Cible au milieu (300 routes) | 0.224 | 0.232 |
| Cible en dernier (300 routes) | 0.226 | 0.235 |
| Paramétrique /res299/:id | 0.546 | 0.655 |
| 100 routes statiques | 0.236 | 0.261 |
| 1 000 routes statiques | 0.230 | 0.238 |

Ratio ordre (dernier / premier) : **1.01×** · ratio échelle (1 000 / 100) : **0.97×**

### Pile HTTP complète (µs / requête)

| Scénario | p50 | p90 | req/s |
|---|---|---|---|
| 0 route + cible | 2.584 | 5.193 | 283807 |
| 100 routes, cible en premier | 2.400 | 3.986 | 301720 |
| 100 routes, cible en dernier | 2.255 | 3.504 | 333326 |
| 300 routes, cible en premier | 2.221 | 3.512 | 318696 |
| 300 routes, cible en dernier | 2.130 | 3.088 | 366649 |

### Validation de réponse (µs / requête)

| Scénario | p50 | p90 |
|---|---|---|
| Développement (validation active) | 15.572 | 24.000 |
| Production (validation désactivée) | 2.715 | 4.244 |

### Body parser (µs / requête)

| Scénario | p50 | p90 | Octets |
|---|---|---|---|
| Lecture native JSON 547 octets | 0.788 | 2.815 | 534 |
| POST JSON 547 octets (pile complète) | 6.163 | 11.781 | 518 |
| POST JSON 10 Ko (pile complète) | 9.523 | 19.168 | 9984 |

### Démarrage à froid (ms)

| Entrée | p50 |
|---|---|
| Import framework | 53.9 |
| Import decorators | 16.4 |

### HMR et classification

| Scénario | p50 | p90 |
|---|---|---|
| Reload contrôleur 3 routes (ms) | 0.310 | 0.421 |
| Classification 5 000 fichiers (ms) | 1.317 | 2.385 |

### Observabilité

| Mode | p50 (µs) | Surcoût p50 |
|---|---|---|
| off | 2.250 | 0.00 % |
| metrics | 5.885 | 161.56 % |
| traces | 6.395 | 184.22 % |

