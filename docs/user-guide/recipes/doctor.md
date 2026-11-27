# Recette — diagnostic

**Objectif** : obtenir une action corrective par problème.

```bash
raiton doctor
raiton doctor --json
raiton doctor --fix
```

**Attendu**

- chaque problème expose un code stable, une sévérité, une action et un lien de documentation ;
- `--fix` applique uniquement les corrections sûres (par exemple `.env.example`) ;
- une erreur de sévérité `error` retourne le code de sortie `4` ;
- une configuration invalide empêche l'écoute et liste les champs fautifs.
