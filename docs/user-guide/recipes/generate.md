# Recette — générer une ressource

**Objectif** : produire des fichiers qui compilent et dont le test passe.

```bash
raiton generate resource users
raiton generate mcp-tool refund
```

**Fichiers produits**

```text
source/dtos/users.dto.ts
source/repositories/users.repository.ts
source/services/users.service.ts
source/controllers/users.controller.ts
tests/users.test.ts
```

**Simulation et conflits**

```bash
raiton generate resource users --dry-run
raiton generate resource users --force
```

**Attendu** : sans `--force`, un fichier existant n'est jamais écrasé (code de sortie `3`).
Avec `--dry-run`, aucun fichier n'est écrit.
