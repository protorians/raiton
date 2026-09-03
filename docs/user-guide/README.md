# Guide Développeur

Ce dossier décrit comment utiliser Raiton pour créer un serveur d'API.

## Menu

| Chapitre | Description |
|---|---|
| [getting-started.md](getting-started.md) | Démarrer un serveur avec `source/main.ts` et `raiton.config.ts` |
| [config.md](config.md) | Configurer `raiton.config.ts` et la racine du projet |
| [architecture.md](architecture.md) | Structurer le projet par domaine |
| [api/README.md](api/README.md) | Déclarer les routes, paramètres et réponses |
| [decorators/README.md](decorators/README.md) | Utiliser les décorateurs de contrôleur, paramètre, injection et OpenAPI |
| [runtime.md](runtime.md) | Choisir et configurer le runtime |
| [env.md](env.md) | Lire les variables d'environnement |
| [encryption.md](encryption.md) | Hasher et vérifier des secrets |
| [injection.md](injection.md) | Injecter des services et séparer la logique métier |
| [middleware.md](middleware.md) | Exécuter des règles transverses sur les requêtes |
| [responses.md](responses.md) | Structurer les réponses et les erreurs |
| [body-parser.md](body-parser.md) | Lire JSON, formulaires et fichiers |
| [security.md](security.md) | Sécurité HTTP, CORS, rate-limit, body-limit |
| [health-check.md](health-check.md) | Endpoint de contrôle et vérifications de santé |
| [https.md](https.md) | HTTPS, certificats et environnements |
| [openapi/README.md](openapi/README.md) | Générer et documenter l'API |
| [sockets.md](sockets.md) | Déclarer et gérer les sockets |
| [mcp.md](mcp.md) | Exposer outils, prompts et ressources via le protocole MCP |
| [tutorial.md](tutorial.md) | Construire une mini API complète de bout en bout |
| [plugins.md](plugins.md) | Vue d'ensemble des plugins intégrés |
| [types.md](types.md) | Comprendre les types utiles au développeur |
| [cli.md](cli.md) | Flux de développement, build et start |
| [best-practices.md](best-practices.md) | Recommandations d'organisation |

## Parcours recommandé

1. lire [getting-started.md](getting-started.md)
2. lire [config.md](config.md)
3. lire [architecture.md](architecture.md)
4. lire [api/README.md](api/README.md)
5. lire [decorators/README.md](decorators/README.md)
6. lire [runtime.md](runtime.md)
7. lire [env.md](env.md)
8. lire [encryption.md](encryption.md)
9. lire [injection.md](injection.md)
10. lire [middleware.md](middleware.md)
11. lire [responses.md](responses.md)
12. lire [body-parser.md](body-parser.md)
13. lire [security.md](security.md)
14. lire [https.md](https.md)
15. lire [openapi/README.md](openapi/README.md)
16. lire [sockets.md](sockets.md)
17. lire [mcp.md](mcp.md)
18. lire [health-check.md](health-check.md)
19. lire [types.md](types.md)
20. lire [tutorial.md](tutorial.md)
21. lire [plugins.md](plugins.md)
22. lire [cli.md](cli.md)

## Ce que couvre ce guide

- le bootstrap dans `source/main.ts`
- la configuration du projet via `raiton.config.ts`
- une organisation modulaire par domaine
- les routes, contrôleurs et réponses
- l'injection de services
- les plugins de sécurité et de documentation
- le protocole HTTPS et la gestion des certificats
- les endpoints et vérifications de santé (health-check)
- le cycle local `dev` / `build` / `start`

> **Navigation :** [← docs/](../README.md) | [← contributeurs](../contributors/README.md)
