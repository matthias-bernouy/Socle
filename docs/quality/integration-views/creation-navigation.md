# Fiche unique : création, navigation et modals

Date : 7 septembre 2026. Travail sur `master`, sans commit. Ce bilan décrit les tests simulés du retrait ; [la vérification réelle et l’installation locale](local-installation.md) ont été réalisées ensuite.

## Décision et périmètre

À la demande de l’utilisateur, l’API expérimentale `setSourceReloadUrl` a été supprimée. Les cinq fichiers du binding qui la portaient (`Source`, registre de relecture, transaction et deux exports) correspondent de nouveau à `HEAD`. Aucun nouveau callback de relecture, attribut de binding ou changement de son cycle de rendu n’est nécessaire à ce parcours.

La fiche produit et les fiches marque/catégorie utilisent une seule définition et leur endpoint Save commun. La lecture sans identifiant fournit les valeurs initiales de l’intégration sans créer de ressource. `id` et la révision absents sont omis par les vrais champs techniques du formulaire. Après la première création, le contrôleur de dashboard ouvre la même définition avec l’identifiant renvoyé et effectue un GET normal. Les sauvegardes d’une fiche existante continuent à utiliser `cms-source-success-reload`.

Le lookup marque ouvre sa vue complète dans une grande modal pour créer ou modifier. Une création réussie sélectionne le résultat et ferme la modal. Une modification relit la source de la modal avant de fermer et d’actualiser le libellé. La fiche produit ne se recharge pas et conserve son brouillon. Les options récemment enregistrées prennent priorité sur les anciens libellés du lookup. Le bouton de création des tableaux utilise une délégation sur son propriétaire stable, car les boutons sont instanciés par le binding.

L’ancien mécanisme de création inline des lookups a été retiré ; `allowCustom` accepte une valeur locale, sans mutation distante implicite. Les opérations métier avec leur propre formulaire de confirmation restent distinctes de la sauvegarde de fiche.

## Cas de reprise

- Une erreur de création conserve les contrôles et la référence technique de tentative.
- Une réponse de succès sans identifiant produit un message explicite et bloque une nouvelle soumission de création ; elle n’est pas assimilée à une erreur autorisant un nouvel enregistrement.
- Si la lecture de la ressource créée échoue, l’URL contient déjà son identifiant. Retry relit cette ressource sans rejouer Save.
- La modal confirme l’abandon de sa saisie et interdit sa fermeture pendant l’écriture. Le verrouillage du formulaire reste celui du binding.
- Les formulaires et contrôles d’une modal ne sont pas collectés par la fiche parente.
- Les médias peuvent être transférés avant la première sauvegarde. Le formulaire soumet leurs identifiants ordonnés et la référence scalaire de session ; l’intégration gère leur rattachement.

## Vérification visuelle et limite mesurée

Les captures desktop/mobile montrent les mêmes positions de champs avant et après la navigation. Sur un GET artificiellement ralenti à 500 ms, le champ titre est absent pendant environ 496 ms à 1440 px et 500 ms à 390 px. Son ancien nœud est déconnecté. Le chargement remplace donc temporairement la fiche après la **première** sauvegarde : ce parcours ne garantit pas la conservation du DOM ni l’absence de transition visuelle à cet instant.

En édition, les tests vérifient au contraire la conservation des nœuds, du focus, des dimensions et du défilement pendant Save et la relecture. Les tests d’images vérifient la conservation des anciennes images et de la tuile temporaire pendant son transfert.

Preuves locales :

- `/tmp/cmscore-navigation-measure.log` : deux lectures (`sans id`, puis `id=43`), positions identiques avant/après et durée de chargement mesurée.
- `/tmp/cmscore-navigation-{1440,390}-{loading,loaded}.png` : état transitoire et fiche chargée.
- `/tmp/cmscore-unified-{product-new,product-saved,brand-create,brand-edit}-{1440,390}.png` : huit captures des parcours ; images inspectées, aucune largeur dépassant le viewport.
- `/tmp/cmscore-create-navigation-media-recovered.png` : création avec images après reprise du GET échoué.

Les captures et fixtures navigateur utilisent le bundle réel et les définitions officielles, avec des réponses HTTP simulées. Elles ne constituent pas une installation de ces nouveaux contrats sur la démo Courtside.

## Vérifications techniques

- Build du workspace réussi.
- `check:all` final : 8/8. Référence au début du retrait : 5/8, avec les erreurs de compilation de l’essai et les anciens consommateurs de contrat encore présents.
- Binding : 37 tests, 178 assertions passent. Le preload temporaire remet l’origine DOM à `http://localhost/`, attendue par un ancien test ; le setup général du workspace utilise le port 4999. Aucun changement de source nécessaire pour ce décalage de fixture.
- Nettoyage des lookups : 7 tests unitaires et 2 tests navigateur passent.
- Contrats : 92 tests vérifiés lors de leur migration, ainsi que TypeScript des deux packages.
- Backend Commerce : 175 tests HTTP, suite SQL isolée et scénarios de concurrence vérifiés par l’agent responsable. Création avec images, appartenance des sessions et reprise idempotente couvertes.
- Parcours navigateur : 26 scénarios produit, création, opérations, images et stabilité. Les 26 scénarios passent dans la relance complète fichier par fichier (10 processus distincts). Le lancement groupé a rencontré quatre timeouts intermittents ; les résultats des deux modes sont conservés séparément. La cause des timeouts groupés n’est pas établie. Ne pas présenter ce lancement groupé comme entièrement passant.

Journaux : `/tmp/cmscore-create-navigation-{build,after,binding-final}.log`, `/tmp/cmscore-create-navigation-e2e-final.log`, `/tmp/cmscore-navigation-test-files.log`, `/tmp/cmscore-navigation-file-*.log` et `/tmp/cmscore-product-endpoints/`.

## Travail restant hors de cette validation

La migration locale, initialement différée pour préserver les uploads 169 et 170, a ensuite été réalisée avec archivage protégé et conservation des fichiers. Les nouveaux endpoints et vues ont été vérifiés sur Courtside local ; voir [le bilan de cette correction](local-installation.md).

La généralisation aux autres intégrations de l’étape 5 reste à réaliser. Les anciennes actions de création de Forms, Consent, Emailer et des autres ressources n’ont pas été converties aveuglément : certaines nécessitent des adaptations métier de lecture, sauvegarde ou identité. Cette validation concerne le nouveau contrat et les parcours produit/taxonomie, pas l’achèvement de toute la migration des intégrations.

Les fichiers de fixture navigateur et de composition qui dépassent le seuil de taille restent cohésifs ; aucun découpage purement mécanique n’a été ajouté. Les diagnostics de taille restent des informations de relecture, et aucune erreur de fanout n’est laissée par le chantier.
