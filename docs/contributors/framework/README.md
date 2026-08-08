# Module Framework

Le dossier `source/framework/` regroupe les briques publiques du framework: décorateurs, runtime, réponses, exceptions, plugins, utilitaires et classes de base.

> **Navigation :** [← docs contributeur](../README.md) | [↑ Index](../README.md) | [runtime.md →](runtime.md)

## Menu

| Chapitre | Description |
|---|---|
| [runtime.md](runtime.md) | Adaptateurs Bun et Node, fabrique `Runtime` |
| [responses.md](responses.md) | Réponses HTTP, exceptions, helpers de rendu |
| [encryption.md](encryption.md) | Hash, dérivation, mots de passe |
| [env.md](env.md) | Variables d’environnement |
| [base-classes.md](base-classes.md) | DTO, ViewModel, services, repositories, bag de paramètres |
| [decorators/](decorators/README.md) | Décorateurs du framework |
| [plugins/](plugins/README.md) | Body parser, OpenAPI, sécurité |

## Ce que fournit ce module

- un système de décorateurs basé sur `reflect-metadata`
- une abstraction runtime pour Bun et Node
- des réponses et exceptions prêtes à l’emploi
- des helpers pour la sécurité, l’OpenAPI et les requêtes
- des classes de base pour structurer une application

## Vue d’ensemble des exports

```text
framework/
├── index.ts
├── controllers.ts
├── services.ts
├── repositories.ts
├── view-model.ts
├── data-transfer-object.ts
├── encryption.ts
├── parameter-bag.ts
├── artifacts.ts
├── env.ts
├── decorators/
├── plugins/
├── runtime/
├── enums/
├── constants/
├── exceptions/
├── responses/
└── utilities/
```

## Parcours recommandé

1. Commencer par [runtime.md](runtime.md) pour comprendre l’exécution HTTP.
2. Lire [responses.md](responses.md) pour voir comment les réponses et exceptions sont rendues.
3. Lire [decorators/README.md](decorators/README.md) pour la partie la plus visible côté application.
4. Lire [plugins/README.md](plugins/README.md) pour le body parser, OpenAPI et la sécurité.
5. Lire [base-classes.md](base-classes.md) pour les objets de base.

## Points d’attention

- Le module repose fortement sur les métadonnées TypeScript.
- Le runtime Bun est le plus complet.
- Certaines parties sont plus orientées architecture framework que usage applicatif direct.

---

[← docs contributeur](../README.md) | [↑ Index](../README.md) | [runtime.md →](runtime.md)
