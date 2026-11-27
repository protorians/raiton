# Benchmarks Raiton

Rapports générés par le harnais de la spec 001 :

```bash
bun run bench          # rapport Markdown + benchmarks/latest.{md,json}
bun run bench --check  # vérifie les budgets spec 001
bun run bench --check --check-observability  # inclut les budgets spec 002
```

Les fichiers `latest.md` et `latest.json` sont remplacés à chaque exécution. Le
protocole, les scénarios et les budgets de référence sont décrits dans
[`specs/001-performance-optimization/metrics.md`](../specs/001-performance-optimization/metrics.md).

Scénarios couverts : routage indexé, pile HTTP complète, validation de réponse,
body parser, démarrage à froid, reload HMR et classification d'artefacts.

## Debug assisté par IA (spec 003)

```bash
bun run bench:ai          # benchmarks/ai-debug.{md,json}
bun run bench:ai --check  # vérifie les budgets de la spec 003
```

Ce harnais mesure le `DebugJournal` livré (métadonnées et capture complète,
index, sérialisation, mémoire) ainsi que le prototype de référence, la taille
en tokens des artefacts du dépôt et les projections d'économie de tokens pour
`call`, `explain` et `verify`. Les mesures de performance sont réelles ; les
économies de tokens sont marquées « Estimé » tant qu'aucune campagne sur agents
réels n'a été exécutée. Le protocole est décrit dans
[`specs/003-ai-runtime-debug/metrics.md`](../specs/003-ai-runtime-debug/metrics.md).
