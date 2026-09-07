# Étape 1 — Contrats et état de référence

Relevé du 7 septembre 2026, sur `master`, au commit `0b85914ee`. Étape documentaire terminée : aucun code applicatif modifié, aucun commit, aucune intervention en production. L’étape 2 reste à commencer sur demande.

## Livrables et décisions

- [Plan principal et ordre des étapes](../../../REFACTOR_INTEGRATIONS_VIEW.md).
- [Inventaire des fiches, créations, usages du shell et endpoints](inventory.md).
- [Contrats détaillés proposés pour l’implémentation](contracts.md).

L’inventaire couvre 14 intégrations, 35 fiches `w-detail`, 28 tables et 5 listes de navigation. Les widgets référencent 131 endpoints distincts : 71 GET, 53 POST et 7 DELETE. Tous ces identifiants se résolvent dans les définitions examinées. Les opérations de management et les endpoints internes de Control sont comptés séparément. Le shell apparaît dans 28 fichiers ; il faudra migrer ses usages hors dashboards également.

La cible utilise un `save` facultatif, des opérations indépendantes avec leur propre formulaire, un `delete` facultatif et un parcours `create` déclaratif. Les noms des vrais contrôles fournissent les chemins de soumission. Les champs cachés sont réservés aux paramètres techniques scalaires ; les objets éditables ne sont pas recopiés dans un formulaire intermédiaire.

Deux ajouts génériques sont spécifiés : la soumission typée des contrôles et `cms-source-success-update`, qui applique une réponse complète à la source commune. La révision reste définie par l’intégration. La réconciliation conserve une saisie plus récente que la requête et signale les conflits. Ces mécanismes ne sont pas encore implémentés.

## Points métier à préserver

| Constat actuel | Conséquence pour la migration |
| --- | --- |
| 23 endpoints de mutation référencés déclarent des paramètres hors corps. | Examiner leurs identités et adapter les endpoints avec leurs appels ; le binding ne devine pas ces paramètres. |
| Forms, Emailer et certains réglages recopient des propriétés non éditées depuis la ressource. | Les sauvegardes doivent préserver ces propriétés côté intégration, sans JSON caché. |
| Les images produit sont attachées, retirées et réordonnées immédiatement. | Le rattachement au Save nécessite un vrai cycle de fichiers en attente côté intégration. |
| La création produit actuelle exige plus qu’un titre et initialise une visibilité publique. | Ajouter la création minimale avec slug unique, statut brouillon et visibilité cachée. Séparer les exigences de brouillon et de publication. |
| Commerce n’a pas de `deleteProduct`. | Conserver l’archivage ; valider le contrat de suppression sur une marque non référencée. |
| Une sauvegarde de réglages peut persister puis échouer lors de son application. | Distinguer état enregistré et état appliqué, et permettre la relecture sans répéter l’opération fournisseur. |

Ces points sont détaillés dans les contrats. L’enveloppe de chaque domaine, ses autorisations et ses règles de révision restent sa responsabilité. Les opérations réelles nécessitant des clés ne font pas partie de ce relevé.

## Captures et couverture locale

Courtside était déjà accessible sur `http://localhost:5200`. Après connexion, le navigateur de relevé bloquait les requêtes autres que GET et HEAD. Aucun envoi de modification n’a été tenté pendant la campagne principale. Les tests de sauvegarde décrits plus bas utilisent des réponses simulées.

La campagne principale comprend 98 visites, chacune capturée en 1440 × 1000 et 390 × 900 :

| Catégorie de visite | Nombre |
| --- | ---: |
| Dashboard ou liste | 22 |
| Sélection de détail | 28 |
| Ouverture de création | 13 |
| Management d’intégration | 14 |
| Autres pages utilisant le shell | 21 |

Ces catégories décrivent les routes visitées, pas autant de parcours métier validés. Des compléments couvrent les sections et questions de Forms, corrigent un paramètre de navigation utilisateur dans la sonde, distinguent les intégrations affichées depuis plusieurs sources et reproduisent les erreurs. Le dossier contient **218 captures de pages locales**, auxquelles s’ajoutent **4 captures du test de stabilité des réglages**.

Preuves conservées hors Git dans `/tmp/cmscore-integration-view-step1/` :

- [Campagne principale : routes, requêtes et géométrie](/tmp/cmscore-integration-view-step1/baseline.json), [compléments](/tmp/cmscore-integration-view-step1/extras.json) et [reproductions ciblées](/tmp/cmscore-integration-view-step1/followup.json).
- Produit : [desktop](/tmp/cmscore-integration-view-step1/screens/commerce-productDetail-detail-1440.png), [mobile](/tmp/cmscore-integration-view-step1/screens/commerce-productDetail-detail-390.png), [bas de fiche desktop](/tmp/cmscore-integration-view-step1/screens/commerce-productDetail-detail-scroll-1440.png) et [bas de fiche mobile](/tmp/cmscore-integration-view-step1/screens/commerce-productDetail-detail-scroll-390.png).
- Réglages simulés après Save : [desktop](/tmp/cmscore-integration-view-step1/connection-stability/1440-saved.png) et [mobile](/tmp/cmscore-integration-view-step1/connection-stability/390-saved.png).

Ces chemins sont des preuves locales temporaires, pas des ressources du dépôt. Les scripts de relevé et leurs journaux se trouvent dans le même dossier. Les captures de données locales ne doivent pas être publiées automatiquement.

L’inspection visuelle ciblée du produit confirme la disposition main/aside sur desktop, leur empilement mobile et le maintien des navigations au bas de la fiche. Les mesures ne détectent aucun débordement horizontal du document sur les 196 captures de la campagne principale. Des tables et des conteneurs internes ont leur propre débordement : ce résultat ne signifie pas que tous les débordements internes sont corrects. Les autres captures servent de référence pour la comparaison lors de leur migration ; elles n’ont pas toutes fait l’objet d’une revue visuelle détaillée.

Limites de couverture : les tables de réclamations, demandes de remboursement et litiges Stripe sont vides localement. Le détail des preuves de réclamation dépend également d’une réclamation absente. Leurs états remplis devront être couverts par des fixtures lors de la migration. Les états transitoires d’installation et d’import sont inventoriés dans les templates, sans lancer d’installation pour les photographier. Ouvrir une création ne valide pas sa persistance.

## Erreurs préexistantes reproduites

Deux fiches échouent actuellement pendant leur composition : le contexte Consent `protected_payment` et un détail de livraison Mondial Relay. L’exception est `Cannot read properties of null (reading 'content')` dans `fieldElement`.

Le [compositeur de champ](../../../packages/surfaces/cms-control/src/components/admin/Resources/Dashboards/widgets/w-detail/binding/fields.ts) sélectionne un template à partir du format de lecture seule. Ces définitions utilisent `format: "url"`, mais le [catalogue de contrôles](../../../packages/surfaces/cms-control/src/static/admin/_content/sources/_runtime/detail/controls.html) n’a pas de template `data-control="url"`. La sélection renvoie `null` et interrompt la composition. Ces deux erreurs sont consignées, sans correction pendant cette étape documentaire. La création d’un contexte Consent a été ouverte séparément sans cette exception.

La première sonde utilisateur produisait aussi un GET 400 : elle encodait une seconde fois le `subParam` déjà encodé par l’API. Le relevé complémentaire utilise ce paramètre directement. Ce 400 appartient à la sonde et n’est pas compté comme régression de l’application.

## Vérifications exécutées

| Vérification | Résultat initial |
| --- | --- |
| `bun run check:all` | 8 contrôles réussis, 0 échec. |
| Contrats UI | 0 erreur, 73 avertissements, 11 informations ; 50 fichiers concernés sur 3610 examinés. |
| Taille des fichiers | 606 informations, 399 avertissements consultatifs. |
| Nombre d’entrées par dossier | 320 informations, 0 erreur bloquante. |
| Tests du binding : soumission, sérialisation, frontières de template | 52 réussis, 0 échec, 164 assertions. |
| Tests navigateur ciblés : actions, médias, lookups, listes, tables, schémas, conditions | 9 réussis et 1 expiration de délai dans le lot initial de 10 tests. |
| Relance isolée du test de stabilité des réglages | Réussie en 1,62 s ; 32 assertions, captures desktop/mobile. |
| Sonde source commune, bouton externe et modal | Réussie ; confirme aussi la nécessité du raccord d’actualisation. |

Le timeout initial de 30 secondes n’a pas été reproduit lors de la relance isolée. Cela ne prouve pas son absence sous charge ; il reste documenté dans [le journal du lot](/tmp/cmscore-integration-view-step1/browser-tests.log). La relance vérifie notamment le maintien d’une saisie plus récente, de sa sélection et du scroll pendant Save, sans relecture des réglages.

La [sonde de formulaires partageant une source](/tmp/cmscore-integration-view-step1/shared-source-forms-probe.log) effectue un seul GET initial et utilise les mêmes identifiant et révision dans deux vrais formulaires séparés. Le bouton externe soumet bien le formulaire et la modal se ferme. En revanche, après une réponse de Save contenant la révision 8, les champs techniques restent à 7 faute de raccord explicite à la source parente : c’est le comportement actuel que l’étape 3 doit traiter.

Les [résultats initiaux de quality](/tmp/cmscore-integration-view-step1/check-initial.log), [tests du binding](/tmp/cmscore-integration-view-step1/binding-tests.log) et [relance navigateur](/tmp/cmscore-integration-view-step1/connection-recheck.log) sont conservés. Aucun avertissement existant n’a été supprimé pour améliorer artificiellement ce relevé.

Le [dernier `check:all`](/tmp/cmscore-integration-view-step1/check-final.log) donne le même résultat : 8 contrôles réussis, 0 échec, et les mêmes comptes de diagnostics UI et de structure. Les liens locaux et les exemples JSON des documents ont été vérifiés ; `git diff --check` et la vérification des nouveaux fichiers ne signalent aucune erreur d’espacement.

## Mesures et budgets pour les étapes suivantes

Sur les 98 navigations initiales : minimum 3165 ms, médiane 3388 ms, percentile 95 selon rang inférieur 3744 ms, maximum 3854 ms. Le chronomètre inclut la navigation complète et l’attente `networkidle`, donc au moins sa fenêtre de silence de 500 ms. Il ne mesure ni le temps serveur seul ni le délai précis de première interaction. Les durées réseau du premier journal valent `-1` et sont inutilisables ; les compléments utilisent les entrées `PerformanceResourceTiming`.

Une [fixture de sauvegarde](/tmp/cmscore-integration-view-step1/timings.json) mesure cinq envois de champs texte et cinq envois comportant également un booléen. Chaque série conserve **1 lecture initiale, 5 mutations et aucune relecture du détail**. Entre clic piloté et réponse : environ 44–48 ms ; jusqu’à la valeur normalisée et deux frames supplémentaires : environ 76–93 ms. Ces dix mesures contrôlées décrivent le coût navigateur actuel avec réponses simulées ; elles ne constituent pas un benchmark de sauvegarde réelle ou de fournisseur.

Critères de validation à appliquer aux prochains lots :

| Sujet | Critère mesurable |
| --- | --- |
| Lecture commune | 1 lecture du détail au chargement ; pas de requête supplémentaire par section pour ses données. Mesurer séparément lookups et listes indépendantes. |
| Save avec réponse complète | 1 mutation par soumission, aucune relecture de la fiche ; état de succès et révision actualisés avant les effets suivants. |
| Action nécessitant une relecture | 1 mutation puis au plus 1 relecture ciblée ; aucun rechargement global des dashboards ou de la navigation. |
| Réseau lent | Réponse simulée retardée de 1500 ms ; retour visuel pending en moins de 100 ms après dispatch et blocage des doubles envois. |
| Application locale | Sur au moins 20 essais comparables, percentile 95 inférieur à 100 ms entre réception de la réponse et UI stabilisée, hors animations intentionnelles. |
| Géométrie | Aucun déplacement supérieur à 2 px des éléments fixes ou inchangés pendant pending/success ; aucun débordement horizontal nouveau du document. |
| Saisie et navigation | Même contrôle monté, même focus et sélection ; scroll conservé à 1 px près lorsque le contenu garde sa taille. Tester au bas de la fiche sur les deux viewports. |
| Brouillons et conflits | Une saisie faite après submit survit ; une action indépendante ne marque pas le formulaire principal enregistré ; un conflit réel est visible et bloque l’écrasement silencieux. |
| Persistance | Après Save, fermer et relire la fiche ; comparer scalaires, valeurs vidées, listes et associations médias. Tester les erreurs partielles. |
| Navigation pendant requête | Aucune réponse tardive appliquée à une autre fiche, même si le même élément DOM est réutilisé. |
| Comparaison des navigations | Même machine, bundle, données et protocole ; investiguer une régression de médiane ou de percentile 95 dépassant le plus grand de 100 ms et 20 %. |
| Erreurs | Aucune nouvelle exception JavaScript ni erreur réseau inattendue dans le lot migré. Les deux erreurs préexistantes restent explicitement suivies. |

Les budgets sont des critères à vérifier, pas des performances déjà démontrées pour le futur code. Toute limite des répétitions qui empêche de garder un contrôle monté devra être rapportée avant d’élargir le chantier à un mécanisme `key`.

## Point d’arrêt

La prochaine étape est uniquement le nouveau body du shell et la migration de ses usages, avec comparaison visuelle. Les formulaires typés, la réconciliation, les contrats de définition et les endpoints viendront dans les étapes suivantes. Le code applicatif de `master` reste celui du début de ce relevé.
