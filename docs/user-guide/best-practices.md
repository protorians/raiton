# Bonnes pratiques

> **Navigation :** [← cli](cli.md) | [↑ user-guide](README.md)

Dans un projet Raiton, gardez ces règles simples :

- importez `reflect-metadata` une seule fois au point d’entrée
- gardez les contrôleurs fins
- déplacez la logique métier dans des services
- isolez l’accès aux données dans des repositories
- préférez des routes stables et explicites
- activez les plugins de sécurité dès que l’API est exposée publiquement
- centralisez les conventions par domaine
- utilisez une structure modulaire quand plusieurs fonctionnalités métier cohabitent

## Exemple de découpage

- `UsersController` reçoit la requête HTTP
- `UsersService` applique les règles métier
- `UsersRepository` lit/écrit les données
- `UsersDto` décrit les entrées attendues
- `UsersMiddleware` gère les règles transverses
- `UsersResponses` garde un format de sortie stable

Ce découpage garde l’application lisible quand le nombre de routes augmente.

## Ce qu’il faut éviter

- un `main.ts` qui contient toute la logique métier
- des contrôleurs qui parlent directement à la base
- des routes sans convention de nommage
- une documentation API séparée du code

---

[← cli](cli.md) | [↑ user-guide](README.md)
