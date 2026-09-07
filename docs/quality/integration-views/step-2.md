# Étape 2 — Shell de détail et migration des usages

Terminée le 7 septembre 2026 sur `master`, sans commit. Le rendu a été reconstruit et vérifié sur Courtside local, accessible sur `http://localhost:5200`. Arrêt avant l’étape 3.

## Changement réalisé

`cms-shell-detail` conserve les slots d’en-tête `back`, `title` et `actions`. Son contenu utilise maintenant le slot `body`. La grille des colonnes est déplacée dans `cms-shell-detail-body`, qui expose `main` et `aside`.

Les dimensions, espacements, styles d’en-tête, variables `--w-detail-*` et breakpoint mobile de 880 px sont conservés. Le nouveau composant ne gère ni données, ni réseau, ni formulaire : son shadow DOM contient uniquement la disposition et ses slots. Les contrôles bindés et leurs formulaires restent dans leur arbre light DOM.

La migration couvre les 21 templates de l’inventaire et les trois constructions dynamiques du shell. Cela comprend les widgets de détail, intégrations, réglages, pages, rôles, utilisateurs, dashboards, thème, fonctions et triggers. L’audit des templates ne trouve plus de `main` ou `aside` directement assigné à `cms-shell-detail` ; chacun possède son body.

La fiche Page utilise le nouveau cas concret : le formulaire `page-settings-form` occupe `slot="body"` et contient les deux colonnes. Le bouton Save de l’en-tête le cible par `form`. Les actions d’édition du contenu et de suppression restent séparées. Les sauvegardes des widgets gardent leur fonctionnement actuel jusqu’aux étapes suivantes.

Références principales :

- [Template du shell](../../../packages/surfaces/cms-control/src/components/admin/Layout/ShellDetail/template.html) et [composant de body](../../../packages/surfaces/cms-control/src/components/admin/Layout/ShellDetail/body/ShellDetailBody.ts).
- [Disposition des colonnes](../../../packages/surfaces/cms-control/src/components/admin/Layout/ShellDetail/body/style.css).
- [Fiche Page migrée](../../../packages/surfaces/cms-control/src/static/admin/_content/pages/detail.html).
- [Contrat interne documenté dans AGENTS.md](../../../packages/surfaces/cms-control/AGENTS.md).

## Vérifications visuelles et requêtes

100 routes locales ont été ouvertes sur desktop et mobile, avec blocage des requêtes de modification après connexion. Aucun envoi de modification n’a été tenté par cette campagne. Les parcours absents des données locales gardent les limites recensées à l’étape 1.

La comparaison avec l’état initial porte sur **200 captures**. Les compléments corrigent la sonde utilisateur et les noms de captures ambigus des intégrations partagées entre sources. Résultats :

- Aucune différence de géométrie des shells pour les relevés comparables.
- Aucun débordement horizontal du document sur les 200 relevés de cette étape.
- Aucun ancien slot de colonne directement sous le shell dans les arbres DOM examinés.
- Même ensemble et même nombre de requêtes par route comparable.
- Aucun écart visuel dépassant 0,1 % des pixels, avec un seuil de différence de 25 sur un canal RGB. L’écart maximal mesuré est de 0,0456 % ; ce seuil automatisé complète l’inspection visuelle ciblée et ne la remplace pas.

Les captures de début et de bas de fiche Produit ont aussi été inspectées : les navigations restent en place et les colonnes s’empilent comme avant sur mobile. La fiche Page conserve sa disposition avec le nouveau formulaire commun. Les états `detail`, `setup` et `importing` des intégrations ont été rendus séparément sur fixtures avec l’ancien et le nouveau bundle : leurs six paires desktop/mobile ont une géométrie et des pixels strictement identiques, sans lancer d’installation réelle.

La campagne principale observe une médiane de navigation de 3418 ms et un percentile 95 au rang inférieur de 4008 ms, contre 3388 ms et 3744 ms au relevé initial. Ces durées incluent `networkidle`, des données de navigation partiellement différentes et les autres validations exécutées en parallèle ; elles ne mesurent pas le seul coût du shell. Aucun appel supplémentaire n’est introduit sur les routes comparables. Le maximum de 6130 ms concerne le détail de question ajouté à la couverture Forms.

Preuves locales, conservées hors Git dans `/tmp/cmscore-integration-view-step2/` :

- [Relevés des 100 routes](/tmp/cmscore-integration-view-step2/baseline.json) et [comparaison des captures](/tmp/cmscore-integration-view-step2/comparison.json).
- [Produit desktop](/tmp/cmscore-integration-view-step2/screens/commerce-productDetail-detail-1440.png), [bas de produit mobile](/tmp/cmscore-integration-view-step2/screens/commerce-productDetail-detail-scroll-390.png) et [fiche Page](/tmp/cmscore-integration-view-step2/screens/page-detail-1440.png).
- [États d’intégration avant/après](/tmp/cmscore-integration-view-step2/import-states.json).
- [Réglages après sauvegarde sur mobile](/tmp/cmscore-integration-view-step2/connection-stability/390-saved.png).

Les deux erreurs JavaScript préexistantes de Consent et de livraison sont toujours reproduites, avec la même cause documentée à l’étape 1. Aucun nouvel échec de requête API n’est observé dans la campagne principale.

## Tests et contrôles

| Vérification | Résultat |
| --- | --- |
| Construction `bun run build` | Réussie après la migration du shell et des templates. |
| Tests de composants, réglages, intégrations, thème, fonctions, triggers et fiche Page | 86 réussis, 537 assertions. |
| Nouveaux tests navigateur du shell et de la fiche Page | 2 réussis, 42 assertions. |
| Stabilité des réglages : double clic, saisie pendant Save, sélection, focus, scroll, relecture | Réussi, 32 assertions, captures desktop/mobile. |
| Lot navigateur médias, actions, schémas, conditions, lookups, tables et listes | 8 réussis, 1 expiration de délai sur le lookup. |
| Relance isolée du lookup | Réussie en 990 ms, 11 assertions. |

Les nouveaux tests vérifient les dimensions à 1440, 900, 880 et 390 px, la disposition sans aside utilisée par le thème, l’association native des contrôles au formulaire et la séparation des actions. Le scénario Page modifie un champ de chaque colonne, soumet depuis l’en-tête, reçoit une erreur 422, conserve la saisie, corrige puis sauvegarde et vérifie les valeurs après navigation et relecture simulée.

Les tests existants de stabilité couvrent aussi les valeurs normalisées, les modifications plus récentes que la requête, les réponses tardives, les listes et tableaux éditables et les acquittements de médias. Le timeout du lookup a été conservé dans le bilan ; une relance isolée réussie ne garantit pas l’absence de fragilité sous charge.

Tests ajoutés : [layout.test.ts](../../../packages/surfaces/cms-control/tests/browser/dashboards/workspace/detail-shell/layout.test.ts) et [page-form.test.ts](../../../packages/surfaces/cms-control/tests/browser/dashboards/workspace/detail-shell/page-form.test.ts). Journaux : [composants](/tmp/cmscore-integration-view-step2/component-tests.log), [shell](/tmp/cmscore-integration-view-step2/shell-tests.log), [réglages](/tmp/cmscore-integration-view-step2/connection-tests.log), [lot navigateur](/tmp/cmscore-integration-view-step2/dashboard-tests.log), [lookup isolé](/tmp/cmscore-integration-view-step2/lookup-recheck.log).

## Quality et modifications parallèles

Le `check:all` initial réussit ses 8 contrôles, avec 73 avertissements UI. Le dernier relevé global réussit **7 contrôles sur 8** : typage, contrats UI et structure passent. Aucun nouveau diagnostic UI ou de structure ne vise les fichiers du shell ou ses tests.

Le seul échec restant est le formatage de fichiers Mossa modifiés en parallèle, hors de ce chantier :

- `integrations/collections/mossa/blocs/domains/account/orders/purchases/presentation.ts` ;
- `integrations/collections/mossa/blocs/domains/commerce/checkout/service-withdrawal/controller/Bloc.ts`.

Ces fichiers n’ont pas été modifiés par cette étape. Le relevé global compte désormais 71 avertissements UI, 11 informations, 398 avertissements de taille et 321 informations de fanout, sans erreur bloquante de fanout. Les variations liées aux blocs Mossa ne sont pas attribuées à la migration du shell. Une erreur de typage introduite dans le nouveau test de formulaire a été corrigée avant ce dernier relevé.

`bun run format` a été exécuté après l’implémentation. Après constat des modifications parallèles, le dernier ajustement de test a été formaté uniquement dans son dossier pour préserver l’autre chantier. Les diffs ont été inspectés et vérifiés avec `git diff --check`. Les changements nombreux dans les templates correspondent principalement à l’indentation sous le nouveau body ; le bundle généré contient la reconstruction correspondante.

Journaux [initial](/tmp/cmscore-integration-view-step2/check-initial.log) et [final](/tmp/cmscore-integration-view-step2/check-final.log). Le résultat global décrit le workspace partagé au moment de sa mesure, pas une validation isolée des changements Mossa.

## Point d’arrêt

Le shell et ses usages sont migrés. Aucun contrat `save`, `delete` ou `create` d’intégration n’a été remplacé, et le mécanisme `cms-source-success-update` reste à implémenter. La prochaine étape concerne les formulaires et le binding génériques, après une nouvelle demande de poursuivre. Aucun commit ni déploiement n’a été effectué.
