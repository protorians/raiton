# Recette — inventaire et origine d'une route

**Objectif** : obtenir une vérité machine sur le projet.

```bash
raiton inspect --json > manifest.json
raiton inspect --check
raiton routes --json
raiton why GET /api/users/:id --json
```

**Attendu**

- `manifest.json` valide `schemaVersion: "1.0.0"` ;
- routes, artifacts, graphe d'injection, clés de configuration, variables d'environnement, outils MCP et emplacements source ;
- `why` retourne le fichier, la ligne, le décorateur et l'artifact ;
- en développement, `GET /__dev` affiche la même information.
