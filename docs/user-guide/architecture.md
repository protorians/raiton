# Structure recommandée

> **Navigation :** [← getting-started](getting-started.md) | [api →](api/README.md)

Une structure simple et lisible fonctionne bien pour la plupart des projets.
Le guide recommande une logique par domaine, avec une couche API et des services dédiés.

```text
source/
├── controllers/
├── services/
├── repositories/
├── middleware/
├── plugins/
├── dto/
├── models/
├── modules/
├── core/
└── main.ts
```

Le principe est de séparer :
- la couche HTTP
- la logique métier
- l’accès aux données
- les règles transverses

## Exemple concret

Pour une API de gestion de tâches, une structure lisible peut ressembler à ceci :

```text
source/
├── controllers/
│   └── tasks.controller.ts
├── services/
│   └── tasks.service.ts
├── repositories/
│   └── tasks.repository.ts
├── dto/
│   ├── create-task.dto.ts
│   └── update-task.dto.ts
├── middleware/
│   └── auth.middleware.ts
├── plugins/
│   └── openapi.plugin.ts
├── modules/
│   └── tasks/
│       ├── application/
│       ├── domain/
│       └── presentation/
└── main.ts
```

Règle simple :
- `controller` reçoit la requête et retourne la réponse
- `service` applique la règle métier
- `repository` parle à la base de données
- `dto` définit la forme attendue des données
- `modules/` regroupe un domaine complet quand l’application grossit

## Modèle de module

Un module peut être organisé comme suit :

```text
modules/
└── users/
    ├── application/
    │   └── service/
    ├── domain/
    │   └── entities/
    ├── presentation/
    │   ├── components/
    │   └── views/
    └── index.ts
```

Cette organisation réduit les fichiers dispersés et facilite la lecture par domaine.

---

[← getting-started](getting-started.md) | [api →](api/README.md)
