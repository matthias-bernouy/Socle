# Étape 3 — Formulaires et binding génériques

Travail réalisé sur `master`, sans commit. Les définitions produit et des autres intégrations restent réservées aux étapes 4 et 5.

## Résultat

`cms-bind-value`, son plan de compilation, son site de rendu et le contrat `setBindingValue()` sont retirés. Les usages de production sont migrés : valeurs interpolées dans `value`, et binding booléen existant pour `checked`. Aucun `getFormValue()` n’est ajouté aux composants. Les contrôles gardent leurs propriétés publiques et leur participation native aux formulaires.

Le binding synchronise les attributs ordinaires et les propriétés des contrôles sans réécrire une valeur inchangée. Les options répétées d’un select sont montées avant sa valeur. Le formulaire de soumission ne reprend pas les bindings booléens déjà possédés par sa source parente. Les attributs, directives et données restent dans le light DOM.

Le mode facultatif `cms-source-serialization="typed-json"` collecte les vrais contrôles nommés. Il traite nombres, booléens, valeurs vides, noms imbriqués et tableaux explicites, y compris les contrôles associés par `form="…"`. Les tokens gardent leur chaîne séparée par des virgules. Les collisions, chemins dangereux, tableaux clairsemés et valeurs invalides bloquent la soumission. Les formulaires ordinaires conservent leur sérialisation et leurs uploads multipart.

`cms-source-success-reload="#detail"` attend la mutation puis le GET de la source cible. Aucune réponse de mutation n’est fusionnée avec les données lues ; HTTP 204 fonctionne. Les valeurs sont capturées avant le verrouillage temporaire, qui conserve les champs montés et évite les doubles mutations. L’identité de la source, son URL et sa génération protègent les changements de fiche.

Une relecture conserve le contenu chargé ou vide, expose `refreshing` et distingue `refreshError`. Les contrôles soumis acceptent la normalisation serveur, même si le GET revient à la valeur d’avant la saisie. Les révisions communes actualisent les champs techniques des autres formulaires. Un échec de mutation conserve le brouillon ; un échec de GET après succès déclenche `cms-source:refresh-failed`, sans effets ordinaires de succès ni répétition automatique de la mutation.

Les branches JSON inchangées gardent leurs références. Les répétitions conservent les éléments inchangés à la même position ; les lignes modifiées ou déplacées peuvent remonter. Aucun système de `key` n’est introduit. Les consommateurs d’état de Health, des définitions et du workspace opérateur distinguent maintenant une relecture en cours d’un nouveau résultat. Leurs messages d’erreur prennent aussi en compte les échecs de relecture.

Les contrats publics, validations, exports du compilateur et réglages de l’éditeur de formulaires sont raccordés. Aucun nouvel éditeur natif de champ n’a été inventé : ce catalogue ne possède actuellement pas d’éditeur input/select/textarea correspondant.

## Vérifications

Preuves conservées dans `/tmp/cmscore-integration-view-step3/` :

- `check-initial.log` : 8 contrôles réussis au départ de l’étape.
- `unit-final.log` : 378 tests du binding, des contrôles de formulaire et des widgets ; 1 229 assertions, aucun échec.
- Contrats, validation, compilation et éditeur : 270 tests ciblés réussis lors du raccord des attributs.
- `build-final.log` : construction complète réussie ; bundle Control régénéré.
- `browser-isolated.json` et `browser-isolated/` : 79 tests réussis dans 64 fichiers, chaque fichier navigateur étant exécuté dans son propre processus. L’exécution groupée a produit des fermetures de navigateur et des erreurs de connexion Playwright ; les régressions réelles de Health et du feedback de relecture ont été corrigées puis revérifiées.
- `local/baseline.json`, `local/comparison.json`, `comparison.log` : 100 navigations locales, 200 comparaisons desktop/mobile avec l’étape 2, 196 fichiers image distincts. Géométrie identique et aucun débordement horizontal du document. Écart maximal de pixels significatifs : 0,0293 %, sur l’horodatage de dernière activité du profil utilisateur. Inspection visuelle effectuée sur le profil mobile et la fiche produit desktop.
- Les lectures locales bloquent tout POST/PUT/PATCH/DELETE après connexion. Les écritures des parcours navigateur utilisent des endpoints simulés ; aucune donnée métier locale ni donnée de production n’est modifiée.

Le nouveau parcours contrôlé couvre main/aside, valeurs `0` et `false`, révision dans plusieurs formulaires, normalisation serveur, latences de mutation/relecture, double soumission, conservation des nœuds/focus/défilement, conflit 409, relecture 503 suivie d’un retry GET, action indépendante avec brouillon et navigation pendant une sauvegarde. Les parcours existants couvrent notamment filtres, métadonnées, listes éditables, images, lookups, conditions, sauvegardes, erreurs et responsive.

## Limites et point d’arrêt

- Les erreurs locales Consent `consentContext` et Delivery `shipmentDetail` sont présentes avant et après cette étape : template de contrôle absent. Elles restent hors de ce lot.
- Une action indépendante qui modifie un champ également édité localement exige un garde-fou métier lors de la migration ; aucune fusion de brouillon n’est promise. Après un échec de relecture, le retry conserve une saisie dont la référence serveur n’a pas changé et ne la déclare pas implicitement enregistrée.
- Les lignes déplacées dans une répétition peuvent être remontées. Les uploads et leurs associations transactionnelles avec la fiche restent à traiter dans le parcours produit.
- `Source.ts`, `submission.ts` et `templateSites.ts` restent au-dessus du seuil indicatif de taille. La transaction de soumission, le verrouillage, la réconciliation et le registre de relecture sont séparés par responsabilité ; le contrôleur Source conserve son orchestration et le fichier des sites son regroupement de primitives.
- Dernier contrôle global : 7/8. Seul le contrôle de structure échoue sur deux dossiers générés Mossa, modifiés en parallèle, avec 9 entrées : `definitions/artifacts/blocs/domains/commerce/offers/catalogue` et `definitions/configuration/resources/domains/commerce/offers/catalogue`. Aucun de ces dossiers n’a été modifié pour cette étape.

Arrêt avant la migration du produit et la généralisation aux intégrations. Aucun commit ni déploiement.
