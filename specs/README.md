# Spécifications Raiton

Ce dossier contient les specs au format spec-kit. Chaque spec suit la même structure :

- `spec.md` : document normatif — scénarios utilisateurs, exigences, critères de succès, hypothèses.
- `annex.md` (optionnel) : annexe technique — commandes, schémas, formes de données, risques.
- `metrics.md` (optionnel) : mesures de référence, protocole de reproduction, budgets.
- `checklists/requirements.md` : contrôle qualité avant passage au plan.

## Index

| Spec | Périmètre | Statut | Artefacts |
|---|---|---|---|
| [001-performance-optimization](001-performance-optimization/spec.md) | Coût d'exécution : routage, démarrage, HMR, validation, body parsing | Draft révisé (2026-11-27) | [metrics](001-performance-optimization/metrics.md), [checklist](001-performance-optimization/checklists/requirements.md) |
| [002-framework-optimization](002-framework-optimization/spec.md) | Adoption : onboarding, contrats typés, outillage IA, observabilité, découvrabilité | Draft (2026-11-27) | [annex](002-framework-optimization/annex.md), [checklist](002-framework-optimization/checklists/requirements.md) |
| [003-ai-runtime-debug](003-ai-runtime-debug/spec.md) | Debug runtime assisté par IA : invocation, journal, diagnostic, MCP | Implemented (2026-11-27) | [annex](003-ai-runtime-debug/annex.md), [metrics](003-ai-runtime-debug/metrics.md), [tasks](003-ai-runtime-debug/tasks.md), [checklist](003-ai-runtime-debug/checklists/requirements.md) |
| [004-artifact-bridge](004-artifact-bridge/spec.md) | Découverte et montage des artefacts hors convention : packages, fichiers locaux, middleware/hooks | Implemented (2026-11-27) | [annex](004-artifact-bridge/annex.md), [checklist](004-artifact-bridge/checklists/requirements.md) |

## Règles de cohérence

- La **001** est l'autorité sur les budgets de performance.
- La **002** ne peut pas dégrader un budget de la 001 ; ses fonctionnalités opt-in sont mesurées dans les deux états.
- La **004** ne doit pas dupliquer le scan, la DI, le routeur, les middleware, les hooks, les plugins, le build ou le manifeste existants ; elle doit les étendre de façon additive.
- Toute nouvelle spec doit déclarer explicitement son périmètre, ses exclusions et ses specs liées.
- Une spec n'est prête pour le plan que si sa checklist ne contient aucun point bloquant.
