# CLI et workflow

> **Navigation :** [← plugins](plugins.md) | [best-practices →](best-practices.md)

Le CLI couvre le cycle standard de développement d’une application Raiton.

## Pourquoi utilisé

- lancer rapidement un serveur en local
- vérifier le comportement pendant l’implémentation
- produire une version compilée pour la livraison ou le déploiement

```bash
bun raiton dev
bun raiton build
bun raiton start
```

## Commandes principales

- `dev` lance le projet avec hot reloading
- `build` génère un artefact exécutable
- `start` démarre l’application compilée

## Commandes utiles

```bash
bun raiton --help
bun raiton --version
```

Quand vous faites évoluer l’application, gardez l’ordre suivant :
- modifier le code
- lancer `bun raiton dev`
- vérifier le comportement
- lancer `bun raiton build` avant livraison

## Avantages

- flux simple et prévisible
- adapté au développement quotidien
- garde la différence claire entre exécution locale et artefact compilé

## Inconvénients

- demande de bien distinguer `dev` et `start`
- le build ajoute une étape supplémentaire avant livraison

---

[← plugins](plugins.md) | [best-practices →](best-practices.md)
