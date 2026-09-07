# Étape 4 — Parcours produit

Date : 7 septembre 2026. Étape terminée sur `master`, sans commit de cette étape. Arrêt avant l’étape 5.

L’étape 3 a été commitée après autorisation : `a9446c4f4`. Le bundle généré explique l’essentiel du volume du diff ; il ne faut pas interpréter ses lignes comme autant de logique écrite à la main.

## Fonctionnement implémenté

La fiche produit déclare `save`. Ses champs réels, dans `main` et `aside`, appartiennent au même formulaire light DOM. Le bouton du header cible ce formulaire. Les seuls champs cachés nommés contiennent l’identité du produit et sa révision ; aucun corps JSON éditable n’est recopié dans un formulaire intermédiaire.

Les noms des contrôles déterminent le corps envoyé. Nombres, booléens, valeurs nulles et listes vides conservent leurs types. Les contrôles de métadonnées, tableaux et médias exposent leur `value` standard et participent au formulaire. Les affichages en lecture seule et la matrice dérivée ne sont pas soumis.

Une table éditable peut déclarer `rowKey` pour conserver l’identité métier scalaire de ses lignes. Ce champ technique n’a pas de `name` HTML indépendant : il appartient à la valeur de sa ligne. Il ne transporte ni toute la ligne serveur ni ses données privées. Une nouvelle ligne n’envoie pas d’identité vide. **Ce contrat ne constitue pas un système de réconciliation DOM par key.**

Après Save, le binding effectue un GET ciblé de la fiche. Il n’applique pas le corps de réponse de la mutation à la source commune. La saisie est verrouillée pendant l’écriture et la relecture. Un conflit conserve le brouillon. Si seule la relecture échoue, Retry ne rejoue pas la mutation ; une saisie effectuée après cette erreur reste conservée.

## Création et opérations

- `Create product` ouvre une modal courte. `Create draft` enregistre un titre et ouvre le produit créé ; les valeurs initiales `draft` et `hidden` sont appliquées par Commerce.
- `Create brand` utilise une modal et un formulaire indépendants. La marque existe immédiatement ; son association au produit attend Save. La saisie déjà présente dans le produit est conservée.
- Les opérations déclarant `form` ont leur propre formulaire, avec confirmation ou champs supplémentaires si nécessaire. Le brouillon principal doit être enregistré ou abandonné en rouvrant la fiche avant ces opérations.
- Une opération réussie suivie d’une erreur du GET ne peut pas être rejouée pour récupérer l’affichage. Les autres soumissions attendent également la réussite de Retry.
- `delete` est facultatif. **Commerce ne possède pas de suppression de produit autorisée par son domaine** : aucun bouton ou endpoint de suppression produit n’a été inventé. Le statut d’archivage reste disponible.
- La création en modal fonctionne aussi pour une liste de navigation ; sans destination `opens`, la modal se ferme et seule la source de cette liste est relue. Lorsqu’une liste est incluse dans une fiche, son formulaire de création reste à l’extérieur du formulaire principal, dans les actions de la fiche.

Les contrats de modal sont volontairement bornés aux champs simples pris en charge. Les lookups distants, champs complexes, conditions et source d’initialisation de modal non implémentés sont refusés par validation. La généralisation doit compléter ces cas avant de les utiliser.

## Images et persistance Commerce

L’ajout transfère le fichier via un vrai formulaire multipart vers `stageProductImage`. L’image est en attente ; le produit ne change pas encore. Ajout, remplacement, retrait et ordre deviennent la liste `mediaIds` soumise au Save. Une image encore en cours de transfert bloque Save. Un échec de transfert restaure la sélection antérieure ou retire la nouvelle image en attente.

Commerce valide les associations et les champs dans la même transaction, sous contrôle de révision. Les médias d’un autre produit sont refusés. La réservation de staging et les verrous empêchent qu’un Save accepte un transfert incomplet ou qu’un nettoyage concurrent supprime une image devenue attachée.

Le patch de métadonnées préserve les valeurs privées ou non éditables. Les changements de catégorie et le passage d’un champ de métadonnées vers un axe sont traités côté intégration. Les axes et combinaisons historiques gardent leurs identités ; une sauvegarde sans changement ne reconstruit pas les variantes.

Limites connues :

- Les transferts abandonnés deviennent nettoyables après 24 h, au prochain staging. Il n’y a ni tâche planifiée autonome ni suppression immédiate à la fermeture de la fiche. `discardStagedProductImages` permet également un nettoyage explicite. La suppression physique utilise l’API Storage.
- Les anciens endpoints d’images en autosave restent présents pour les vues non migrées et n’incrémentent pas encore la révision du produit. Leur migration relève de l’étape 5 ; la fiche produit utilise désormais le nouveau Save commun.
- Les listes dont le contenu change peuvent être remontées par le binding existant. Aucun nouveau contrat DOM `key` n’a été introduit.

## Initialisation de l’admin

La vérification des actions conditionnelles a révélé un ordre d’initialisation incorrect : le custom element du binding pouvait démarrer avant l’enregistrement des filtres de l’admin. Il capturait alors une liste de filtres incomplète. L’admin enregistre désormais ses filtres avant de définir le core ; le moteur de binding ne change pas. Un test de champ réellement conditionnel distingue ce cas d’une simple projection de visibilité d’action.

## Vérifications et preuves

Les scénarios navigateur utilisent le vrai bundle admin et les vraies définitions produit, avec endpoints contrôlés pour les erreurs, délais et conflits. Les tests PostgreSQL utilisent une base isolée. Le parcours réel Courtside utilise uniquement des enregistrements de test identifiés.

- 83 tests unitaires de widgets, contrats et parsing : `/tmp/cmscore-integration-view-step4/unit-control.log`.
- 160 tests HTTP Commerce et contrats PostgreSQL, dont concurrence Save/nettoyage et identités historiques : `/tmp/cmscore-product-endpoints/tests-reviewed.log` et `sql-reviewed.log`.
- 107 tests navigateur réussis : 18 sur le parcours produit et les nouveaux formulaires, 89 sur les autres dashboards (73 fichiers exécutés séparément, sans test ignoré). Preuves : `/tmp/cmscore-integration-view-step4/product-final-results.json`, `/tmp/detail-operations-final.log` et `/tmp/cmscore-integration-view-step4/legacy-browser/results.json`.
- Sauvegarde lente : 180 ms d’écriture et 350 ms de lecture injectés ; une seule mutation et un seul GET, contrôles conservés, focus et géométrie stables sur 1440 et 390 px. Le test exige un parcours entre 500 et 2 000 ms.
- Sauvegarde depuis le bas de la fiche : chaque conteneur conserve son défilement, sur desktop et mobile.
- Captures avant/après : même géométrie principale. À 1440 px, seules les coordonnées `(1109, 475)–(1411, 596)` diffèrent, autour de l’ajout prévu `Create brand`. À 390 px, les captures du haut de fiche comparées sont identiques pixel par pixel. Cette mesure ne prétend pas couvrir les parties hors champ.
- Captures et scripts locaux : `/tmp/cmscore-integration-view-step4/screens/` et `/tmp/cmscore-integration-view-step4/`.

Les modifications locales de ressources sont ciblées : définition du dashboard produit, contrats d’endpoints, fonctions SQL et fichiers Edge nécessaires. Les sauvegardes antérieures se trouvent dans `/tmp/cmscore-product-endpoints/local-backup/` et `/tmp/cmscore-integration-view-step4/dashboard-view-before.json`. Aucune installation générale ni opération en production.

Le `check:all` initial avait 7 groupes réussis sur 8 : deux erreurs de fanout Mossa préexistantes. Les diagnostics de cette étape sont comparés à cette référence, en tenant compte du travail Mossa mené parallèlement. Le `check:all` final réussit **8 groupes sur 8**, sans erreur de fanout. `ui-contracts` conserve 65 avertissements et 11 informations, contre 66 avertissements initialement ; cette baisse inclut le travail Mossa parallèle et ne doit pas être attribuée à la seule refonte produit. Les anciens transports des vues non migrées restent à traiter aux étapes 5–6. Aucun nouveau contournement de binding n’a été ajouté pour la fiche produit.

### Parcours réel Courtside et nettoyage

Le navigateur a créé un produit et une marque de test, choisi la catégorie Tennis, renseigné six métadonnées, changé le statut et ajouté un PNG. Le staging ne modifiait pas les associations ; Save les a validées avec les champs. Après réouverture, les valeurs et l’image étaient présentes ; son aperçu était effectivement chargé.

La première écriture a pris 89 ms. Un second Save sans changement a pris 115 ms pour le POST et 153 ms avec le GET ; la révision est passée de 2 à 3 sans perte de métadonnées ni d’image. Ces mesures locales ponctuelles ne constituent pas un engagement de performance en production.

Les seuls enregistrements créés par ce test (produit 570, marque 16, média 162) et leur fichier ont été nettoyés. Les comptages sont revenus à 569 produits, 15 marques, 161 médias et 3 associations, sans média en attente pour le test. Preuves : `local-flow-state.json`, `local-flow-verification.json`, `local-flow-cleanup.json` dans le dossier temporaire de l’étape.

Les captures locales couvrent liste, création, marque, classification, sauvegarde, réouverture, image et mobile. `local-flow-reopened-mobile-bottom.png` contient une transition responsive capturée trop tôt ; `local-flow-mobile-stable-readonly.png` montre l’état stabilisé, sans débordement global (390 px pour une fenêtre de 390 px). La table de variantes conserve son défilement horizontal interne.

### Vérifications finales et limites de structure

`bun run build`, `bun run format`, `bun run check:all` et `git diff --check` passent. Les logs finaux sont `build-final.log`, `format-final.log` et `check-final.log` dans le dossier temporaire de l’étape.

Les nouveaux avertissements de taille ont été relus : le parseur commun `complexFields.ts` reste cohérent à 187 lignes ; la fixture produit et le fichier des quatre tests d’opérations dépassent légèrement 180 lignes pour garder leurs scénarios lisibles. Les modules runtime de formulaire sont séparés par responsabilité ; le répertoire `forms/views` et celui des tests produit ont huit entrées, ce qui reste informatif et ne produit aucune erreur bloquante.

L’étape suivante consiste à généraliser les contrats aux autres intégrations. Les chemins de sauvegarde historiques restent disponibles pour ces vues jusqu’à leur migration ; leur suppression n’appartient pas à cette étape.

### Ajustements après relecture utilisateur

Le raccourci `lookup.create` reste déclaré sur le champ et ouvre la même modal. Après relecture, il utilise un `p9r-icon-button` discret « + » à droite du label, avec nom accessible et infobulle décrivant la création. Les composants officiels `p9r-combobox` et `p9r-token-input` exposent un slot `label-actions` distinct du slot des options ; le label natif reste associé à son input. Le raccourci reste en light DOM et la modal utilise toujours son formulaire indépendant.

La ligne du titre média réserve la hauteur de `Preview` (30 px, 44 px sur mobile). Les vignettes incluent leur bordure dans leurs dimensions. La première image agrandie conserve son comportement desktop ; son ajout peut donc agrandir normalement la carte, sans décalage supplémentaire du titre.

La projection `mediaContext` conserve les objets des mêmes médias à la même position. Le passage de l’identifiant temporaire à l’identifiant enregistré conserve également cet objet, grâce à l’URL du fichier local en attente. Le repeat existant garde ainsi les nœuds des images pendant l’ajout en fin de liste et la fin du transfert. Les propriétés optionnelles sont bien effacées lorsqu’elles disparaissent ; aucune donnée source n’est mutée. Le binding et son contrat restent inchangés. La conservation de toutes les identités DOM lors d’un réordonnancement général reste hors de cet ajustement.

Vérification : 29 tests navigateur et 6 tests unitaires ciblés réussis, dont mesures par frame sur 1440 et 390 px, avec galerie vide puis galerie existante. Les tests contrôlent la hauteur du titre, la position de la grille, les nœuds des vignettes et images conservés, l’ouverture clavier de la modal, les uploads échoués, les remplacements, les sauvegardes et la navigation. Captures `/tmp/cmscore-media-*.png`, journaux `/tmp/cmscore-media-ui-*.log`. Aucun commit.

Le placement du « + » est vérifié sur 1440 et 390 px, ainsi que son ouverture au clavier et la création suivie d’une sauvegarde du produit. Les 5 tests navigateur de création, les 18 tests des sélecteurs et les 71 tests de widgets passent. Captures : `/tmp/cmscore-lookup-plus-desktop.png` et `/tmp/cmscore-lookup-plus-mobile.png`.
