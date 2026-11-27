# Raiton AI debug benchmark

Généré le 2026-11-27T18:55:32.006Z · Bun 1.4.2 · darwin-x64

Ce rapport couvre la spec 003. Les mesures de performance sont réelles ;
les économies de tokens sont des projections marquées « Estimé ».

### Journal de requêtes — implémentation réelle (µs / opération)

| Opération | p50 | p90 | Taille |
| --- | --- | --- | --- |
| Métadonnées — écriture | 0.211 | 0.278 | 863 o |
| Métadonnées — recherche indexée | 0.050 | 0.050 |  |
| Complet — écriture | 1.199 | 1.512 | 1062 o |
| Complet — recherche indexée | 0.052 | 0.071 |  |
| Sérialisation d'une entrée complète | 1.335 | 3.129 |  |
| Mémoire (1 000 entrées, complètes) | 451 Kio |  | ≤ 8 Mio |

### Journal de requêtes — prototype (µs / opération)

| Opération | p50 | p90 | Taille |
| --- | --- | --- | --- |
| Écriture ring buffer | 0.055 | 0.067 | 331 o |
| Recherche linéaire (1 000 entrées) | 5.326 | 5.639 |  |
| Recherche indexée (Map) | 0.071 | 0.073 |  |
| Sérialisation d'un enregistrement | 0.526 | 0.631 |  |

Référence pile HTTP (spec 001) : **2.067 µs** p50. Surcoût capture métadonnées : **2.66 %** ; capture + sérialisation immédiate : **28.11 %**.

### Artefacts — tokens mesurés (cl100k_base)

| Artefact | Octets | Tokens |
| --- | --- | --- |
| docs/llms.txt | 2498 | 627 |
| docs/AGENTS.md | 1979 | 479 |
| README.md | 6673 | 1695 |
| tests/fixtures/project/source/controllers/items.controller.ts | 746 | 201 |
| manifeste du projet fixture |  | 1287 |
| routes du projet fixture |  | 781 |
| OpenAPI du projet fixture |  | 1264 |
| sortie explain (échantillon) |  | 408 |
| sortie call (échantillon) |  | 227 |
| rapport verify (échantillon) |  | 138 |
| extrait de logs (échantillon) |  | 299 |
| réponse curl (échantillon) |  | 73 |

### Économie de tokens par scénario (Estimé)

| Scénario | Sans feature | Avec feature | Économie incrémentale | Économie session neuve |
| --- | --- | --- | --- | --- |
| Diagnostiquer un 400 de validation | 1281 | 408 | 68.1 % | 49.6 % |
| Invoquer une route inconnue | 1055 | 227 | 78.5 % | 54.0 % |
| Invoquer une route connue (contexte chaud) | 274 | 227 | 17.2 % | 6.2 % |
| Vérifier les contrats après modification | 1465 | 138 | 90.6 % | 68.3 % |
| Médiane |  |  | 78.5 % | 54.0 % |

Contexte fixe retenu pour la session neuve : **479 tokens** (AGENTS.md seul).

Hypothèses :
- **Diagnostiquer un 400 de validation** : Contrôleur (174) + extrait de logs (299) + routes (486) contre une explication structurée (408).
- **Invoquer une route inconnue** : Contrôleur (174) + routes (486) + réponse curl (73) contre une invocation structurée (227).
- **Invoquer une route connue (contexte chaud)** : Contrôleur (174) + réponse curl (73) contre une invocation structurée (227) : borne basse réaliste.
- **Vérifier les contrats après modification** : OpenAPI (938) + contrôleur (174) contre un rapport de vérification compact (138).

