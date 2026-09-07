# Refonte des vues des intégrations

Date : 7 septembre 2026. Statut : étape 2 terminée, arrêt avant l’étape 3.

## 1. Cadre de travail

Ce document décrit la refonte des fiches des dashboards, de leurs formulaires, des actions et des parcours de création. Il couvre aussi les usages existants du shell de détail et les adaptations nécessaires dans les intégrations.

- Le travail avance **étape par étape**, dans l’ordre indiqué à la fin du document.
- **Ne pas créer de commit sans demande explicite.** Après l’étape 2, l’utilisateur a autorisé le commit des documents, du shell migré et de ses tests. Cette autorisation ne déclenche pas les étapes suivantes.
- **À la fin de chaque étape, arrêter le travail**, présenter le résultat et attendre la demande de poursuivre. Une étape terminée ne déclenche pas automatiquement la suivante.
- Les étapes 1 et 2 ont été autorisées et réalisées sur `master`, sans commit. Le shell et ses usages sont migrés ; l’étape 3 attend une nouvelle demande de poursuivre.
- Le développement et les vérifications restent locaux. Aucune modification, installation ou publication en production.
- Conserver les données et les réglages de la démo Courtside ainsi que les modifications locales sans rapport avec ce chantier.
- Conserver le principe de versions de départ `1.0.0` demandé pour cette refonte. Ne pas publier de nouvelle version ni construire une couche de compatibilité permanente pour des contrats que nous décidons de remplacer ensemble.
- Ce document est volontairement en français. Le code, les identifiants, les exemples de libellés d’interface et les tests restent en anglais.

## 2. Objectif et raisons de la refonte

Une intégration doit pouvoir décrire une fiche lisible et modifiable avec une lecture commune, un formulaire principal facultatif et des opérations indépendantes. Le rendu utilise les composants officiels de l’admin et le système de binding existant.

Aujourd’hui, l’affichage des données des widgets utilise déjà le binding. En revanche, la sauvegarde passe encore par une collecte propre aux widgets, la préparation d’un objet d’action, puis, pour certains cas, la fabrication d’un formulaire caché intermédiaire. D’autres corps complexes empruntent encore un chemin JSON spécifique. Cette organisation duplique une partie du rôle des formulaires et complique les types, les sauvegardes et les mises à jour de l’interface.

Les principaux objectifs sont :

- utiliser les véritables contrôles de la fiche comme champs du formulaire soumis ;
- rendre claire la différence entre sauvegarder la fiche et exécuter une opération métier ;
- garder les décisions métier dans l’intégration et les mécanismes génériques dans le binding ;
- préserver la saisie, le focus, le défilement et la stabilité visuelle pendant les requêtes ;
- conserver l’interface actuelle hors améliorations de parcours explicitement prévues ici ;
- valider un parcours produit complet avant de généraliser les contrats aux autres fiches.

Le problème n’est pas l’existence d’un champ caché pour un identifiant. C’est la duplication des valeurs éditables dans un second formulaire construit après leur collecte.

## 3. Architecture retenue

### 3.1. Une lecture commune pour la fiche

La source de lecture placée au-dessus de la fiche fournit les données nécessaires à son titre, ses états, ses actions, son contenu principal et son contenu latéral. L’intégration connaît son domaine et optimise cette lecture.

- Ne pas créer une requête par section pour distribuer des données déjà disponibles dans la lecture commune.
- Les champs éditables et les affichages en lecture seule utilisent cette même donnée.
- Les recherches de lookup, les listes paginées et les schémas réellement indépendants peuvent conserver leurs sources dédiées.
- La définition peut présenter des champs en lecture seule dans `main` comme dans `aside`. Ces affichages ne deviennent pas des valeurs éditables à soumettre.
- Les définitions des dashboards restent déclaratives : elles ne contiennent ni HTML arbitraire ni code exécutable. La composition produit le HTML nécessaire à partir des fragments et des composants communs.

### 3.2. Une sauvegarde principale facultative

Une fiche peut déclarer un `save` optionnel. Il représente la sauvegarde commune de ses champs éditables, répartis entre `main` et `aside`.

- Un vrai formulaire regroupe ces contrôles, avec leurs noms et leurs valeurs.
- Le bouton du header cible ce formulaire avec `form="…"` et `type="submit"`.
- La sauvegarde transmet l’ensemble des champs éditables appartenant à ce formulaire. Elle ne transmet pas automatiquement toute la réponse de lecture.
- Les paramètres techniques nécessaires sont ajoutés sous forme de champs cachés déclarés par l’intégration.
- Ne pas répéter un mapping complet du corps de sauvegarde dans chaque définition lorsque les noms des champs et le contrat de l’endpoint suffisent.
- Les URLs de lecture et de sauvegarde peuvent être différentes. Les chemins de données des champs doivent être cohérents avec le contrat de soumission retenu ; l’intégration adapte ensuite son modèle de stockage.
- Un champ absent de la soumission ne signifie pas automatiquement « supprimer sa valeur ». Les valeurs vidées explicitement doivent avoir une représentation définie.

La structure cible de `save`, des champs techniques et du corps de sauvegarde est décrite dans les [contrats de l’étape 1](docs/quality/integration-views/contracts.md). Elle utilise les noms des contrôles et des champs techniques scalaires, avec un préfixe `valuesPath` facultatif ; elle n’impose pas l’enveloppe `{ id, revision, values }` à toutes les intégrations.

### 3.3. Identité et révision appartiennent au contrat de l’intégration

Le binding n’a pas besoin de connaître la signification de `id`, `expectedRevision` ou `expectedVersion`. Il interpole et soumet les champs déclarés.

```html
<input type="hidden" name="id" value="{{ item.id }}">
<input type="hidden" name="expectedRevision" value="{{ item.revision }}">
```

La même source peut alimenter ces champs dans plusieurs formulaires indépendants. Les alias des résultats des formulaires doivent être distincts de celui de la donnée de lecture.

- L’intégration décide si elle utilise une révision et fournit sa valeur courante.
- Lorsqu’elle exige une révision, elle vérifie côté serveur sa présence et sa correspondance. Une omission ne doit pas contourner le contrôle.
- Une intégration sans révision n’a pas à inventer cette notion pour utiliser les formulaires.
- À la création, aucune révision précédente n’est attendue. La représentation de l’absence d’identifiant dépend du contrat retenu ; ne pas imposer arbitrairement une valeur `null` à tous les endpoints.
- La révision peut être un jeton opaque. Le binding ne la calcule pas et ne l’incrémente pas.
- Ces champs sont des paramètres techniques, pas des preuves d’autorisation. Les permissions et les règles métier restent vérifiées par l’intégration.

Une révision n’est pas immuable pendant toute la vie de la fiche : une opération réussie peut la faire changer. Son actualisation est décrite plus bas.

### 3.4. Opérations indépendantes et suppression

Chaque opération métier possède son propre formulaire. Les formulaires restent séparés ; il n’y a pas de formulaires imbriqués.

- Sans information supplémentaire ni confirmation nécessaire : bouton de soumission directe.
- Avec informations supplémentaires : modal contenant le formulaire de l’opération et ses champs.
- Avec confirmation : modal contenant le texte de confirmation, les paramètres techniques et le bouton de soumission.
- L’opération ne sauvegarde pas implicitement les modifications du formulaire principal.
- Une erreur conserve la modal et sa saisie. La fermeture de succès intervient après le traitement de la réussite.

Exemples : demander un prix au vendeur, accepter une offre, refuser une offre, exécuter une action de maintenance de l’intégration.

La fiche peut aussi déclarer un `delete` optionnel, indépendant de `save`. Il expose une suppression avec confirmation, uniquement lorsque cette opération existe et que la ressource est déjà créée. L’intégration décide si la suppression est autorisée, notamment en présence de dépendances. Après succès, fermer la fiche et actualiser la liste concernée. Après échec, conserver la fiche.

L’archivage et les autres transitions métier restent des opérations distinctes. Les liens de navigation et les téléchargements ne deviennent pas artificiellement des sauvegardes.

### 3.5. Création adaptée au contexte

La modal et les valeurs par défaut sont complémentaires. La définition choisit un parcours adapté à la ressource, et l’intégration applique ses valeurs par défaut métier côté serveur.

Pour un produit, le parcours proposé est :

1. `Create product` ouvre une modal courte avec le titre et les informations réellement indispensables pour commencer.
2. `Create draft` crée le produit avec les valeurs initiales appropriées, notamment un statut brouillon et une visibilité non publique.
3. La réponse permet d’ouvrir sa fiche complète.
4. L’utilisateur complète les images, métadonnées, variantes et autres champs, puis enregistre le formulaire principal.

Annuler la modal avant création ne crée rien. Une fois `Create draft` réussi, le brouillon existe, même si l’utilisateur quitte ensuite la fiche. Le libellé et le parcours doivent rendre ce comportement clair.

Pour une marque, la modal peut suffire à réaliser toute la création. Pour une ressource nécessitant beaucoup d’informations avant de pouvoir exister, la création peut ouvrir directement une fiche préremplie. Ces parcours réutilisent les mêmes champs et mécanismes de formulaire.

Un lookup permettant de créer une marque reste une opération indépendante : la création enregistre immédiatement la marque, puis sélectionne son identifiant dans le produit en cours d’édition. L’association au produit est enregistrée au prochain Save. Annuler les modifications du produit ne supprime pas la marque créée.

### 3.6. Images enregistrées avec la fiche

Pour les produits, l’objectif est de rattacher les modifications d’images au Save : ajout, remplacement, ordre et retrait.

- Le transfert physique peut commencer à la sélection du fichier afin de ne pas retarder toute l’expérience.
- Le fichier transféré reste en attente tant que la sauvegarde n’a pas validé son association au produit.
- Save valide les champs et l’état final des associations d’images ensemble.
- Annuler les modifications conserve les associations déjà enregistrées.
- Les fichiers abandonnés ou devenus inutiles doivent être nettoyés avec un mécanisme défini.

Ce changement implique les endpoints et les règles de l’intégration. Le fonctionnement actuel des images de produit effectue des mutations immédiates ; un changement de formulaire seul ne suffit donc pas. Il faut traiter les échecs partiels et les fichiers en cours de transfert. La transaction des données et le stockage physique des fichiers ne constituent pas une transaction unique.

## 4. Shell, composants et composition

Le shell initial exposait directement `main` et `aside`. Ajouter un formulaire autour de ces deux enfants empêchait de conserver cette distribution telle quelle. L’étape 2 a migré les usages vers le body décrit ci-dessous.

La structure désormais implémentée est :

- conserver le header du shell avec ses emplacements pour le titre, le retour et les actions ;
- ajouter un slot `body` pouvant recevoir le formulaire principal ;
- déplacer la disposition des colonnes dans un composant `cms-shell-detail-body` ;
- garder des conteneurs ordinaires pour les contenus principal et latéral, sans multiplier les composants sans responsabilité propre.

Schéma de composition, non exécutable en l’état : les attributs de soumission et les champs sont abrégés. Le composant de body existe depuis l’étape 2 ; le raccord des formulaires des widgets reste à faire.

```html
<section cms-source="/products/42 as item">
    <cms-shell-detail>
        <span slot="title">{{ item.name }}</span>
        <p9r-button slot="actions" type="submit" form="product-save">
            Save
        </p9r-button>
        <form slot="body" id="product-save">
            <!-- Source submission attributes and technical fields -->
            <cms-shell-detail-body>
                <div slot="main"><!-- Main fields --></div>
                <div slot="aside"><!-- Aside fields --></div>
            </cms-shell-detail-body>
        </form>
    </cms-shell-detail>
    <p9r-modal id="product-delete">
        <form><!-- Independent deletion form --></form>
    </p9r-modal>
</section>
```

Le `slot="body"` appartient au formulaire, enfant direct du shell. Le bouton de sauvegarde et le formulaire qu’il cible restent dans le même arbre light DOM. Les identifiants des formulaires et des modals doivent être uniques lorsqu’il y a plusieurs fiches ou widgets.

Les formulaires et leurs contrôles appartiennent au light DOM. Les composants visuels peuvent conserver un shadow DOM pour leurs slots, leur présentation et leur CSS. Une composition en light DOM est saine lorsqu’elle respecte les règles du package ; elle ne doit pas injecter une feuille de style globale susceptible d’affecter les autres composants.

Le `cms-binding-core` est fourni par la composition de page existante. Les widgets ne doivent pas ajouter leur propre core ni reconstruire l’affichage des données à partir de JSON sérialisé dans leurs attributs. Les fragments de composition communs restent dans `static/`, avec la structure déclarative nécessaire au binding.

## 5. Retour de sauvegarde et stabilité de la fiche

### 5.1. Raccord déclaratif à la source de lecture

Ajouter un mécanisme générique permettant à un formulaire de désigner la source de lecture à actualiser après succès. Le contrat de l’étape 1 retient `cms-source-success-update` comme nom cible ; cet attribut reste à implémenter à l’étape 3.

```html
<section id="product-detail" cms-source="/products/42 as item">
    <form
        cms-source="/products/save as saved"
        cms-source-trigger="submit"
        cms-source-success-reset="false"
        cms-source-success-update="#product-detail"
    >
        <!-- Technical fields and editable controls -->
    </form>
</section>
```

Ce nouvel attribut n’existe pas encore. Son contrat proposé est d’appliquer le corps de la réponse réussie à la source ciblée. La réponse doit être complète et compatible avec le résultat de lecture ; une réponse partielle ne doit pas remplacer silencieusement toute la fiche.

`setSourceData()` permet déjà cette actualisation sans GET supplémentaire. Il faut connecter cette capacité à la soumission déclarative et définir la résolution de la cible, sa portée et le traitement des réponses devenues obsolètes. Le mécanisme existant de publication et de relecture peut rester utile lorsqu’une opération ne renvoie pas la fiche complète.

La source garde son état d’affichage chargé. Le chargement de l’opération appartient au formulaire concerné, sans remettre toute la fiche dans son état de chargement initial.

### 5.2. Préserver les modifications encore en cours

La donnée enregistrée et la saisie locale ne doivent pas être confondues.

1. Au submit, mémoriser les valeurs réellement envoyées.
2. Au succès, appliquer la réponse comme nouvelle donnée de référence de la fiche.
3. Pour un champ soumis dont la valeur n’a pas changé depuis le submit, appliquer la valeur confirmée par le serveur, y compris sa normalisation éventuelle.
4. Pour un champ modifié pendant la requête, conserver la saisie actuelle et son état non enregistré.
5. Actualiser les paramètres techniques, notamment la révision, à partir de la réponse acceptée.

Exemple : l’utilisateur envoie `Racket`, puis saisit `Junior racket` pendant la requête. La réponse confirme `Racket`, révision `8`. La référence enregistrée et les champs de révision passent à `8`, tandis que l’input garde `Junior racket` pour la prochaine sauvegarde.

Une opération indépendante ne marque jamais le formulaire principal comme enregistré. Ses champs non modifiés peuvent recevoir les nouvelles valeurs ; ses modifications locales restent présentes. Si l’opération change un champ également modifié localement, signaler le conflit et empêcher son écrasement silencieux. Actualiser une révision ne doit pas servir à contourner un conflit non résolu.

Prévoir une seule mutation simultanée par fiche tout en permettant de continuer la saisie. Une réponse d’une ancienne fiche, d’une ancienne cible ou d’une requête remplacée ne doit pas actualiser la fiche désormais affichée. Une erreur ne réinitialise pas le formulaire et ne déclenche pas de nouvelle tentative automatique avec une révision différente.

Les dashboards possèdent déjà une logique d’acquittement des valeurs envoyées et de conservation des modifications ultérieures. Il faut réutiliser son comportement validé en le raccordant aux vrais contrôles et au cycle de formulaire générique.

## 6. Responsabilités et limites à traiter

| Sujet | Responsabilité et limite |
| --- | --- |
| Lecture, valeurs par défaut, autorisations | L’intégration connaît le domaine et applique les règles côté endpoint. Le client ne déduit pas un format arbitraire. |
| Révisions | Facultatives dans le modèle général, mais obligatoires côté serveur lorsqu’une intégration exige leur contrôle. |
| Soumission des types | Les formulaires actuels ne conservent pas automatiquement tous les types JSON. Définir un contrat commun pour nombres, booléens, listes, objets structurés et valeurs vidées. |
| Contrôles complexes | Métadonnées, tableaux, listes réordonnables et médias doivent participer à la soumission sans un second moteur de collecte dans chaque widget. |
| Contrôles en lecture seule, conditionnels ou désactivés | Distinguer visibilité, édition et participation à la soumission. L’absence d’un champ ne doit pas effacer une donnée par accident. |
| Réponse de sauvegarde | Pour l’application directe à une source, elle doit avoir la forme complète attendue par cette source. Adapter les endpoints concernés. |
| Conflits et changements simultanés | Préserver les brouillons ne suffit pas : ne pas réenregistrer silencieusement une valeur contredite par une opération indépendante. |
| Répétitions | Le binding actuel peut remonter les éléments répétés lorsque les objets de la liste changent d’identité. Mesurer les effets sur les tableaux et les listes éditables. |
| Images | Prévoir le cycle des fichiers en attente, l’état final validé, les erreurs et le nettoyage. Le stockage des fichiers n’est pas atomique avec la transaction des données. |
| Création par lookup | Le contrat mentionne déjà un mode modal, mais son parcours n’est pas entièrement implémenté. Ne pas confondre présence du type et fonctionnement réel. |
| Shell partagé | Sa migration touche aussi des pages internes hors dashboards. Vérifier tous les usages, pas seulement Commerce. |
| Réseau et fournisseurs | Les appels des vues passent par le binding. Les transports particuliers, par exemple un téléchargement binaire, doivent être évalués et documentés individuellement. |

Ne pas ajouter à ce chantier le système de référence de template avec `use`, une nouvelle extension générale d’interpolation ou une réconciliation par `key`. Ces sujets restent différés. Si une limitation mesurée empêche un critère de validation, la présenter explicitement avant d’élargir le contrat.

Les réglages métier et de connexion restent la responsabilité des intégrations. Les sélecteurs officiels de secrets et de pages doivent continuer à fonctionner dans leurs formulaires. Cette refonte ne transfère pas au binding la gestion des webhooks, des installations ou des opérations des fournisseurs.

## 7. Tâches dans l’ordre et points d’arrêt

Chaque étape inclut son propre bilan et se termine par un arrêt pour relecture. Les cases cochées correspondent au travail réalisé ; les suivantes restent à faire.

### Étape 0 — Document de cadrage

- [x] Rédiger ce document en français avec les décisions, les raisons, les limites et l’ordre des tâches.
- [x] Relecture du document par l’utilisateur et intégration de ses corrections.
- [x] Arrêt avant toute implémentation ; attendre la demande de commencer l’étape 1.

### Étape 1 — Contrats détaillés et état de référence

- [x] Inventorier les usages du shell, les fiches, leurs actions, les créations et les endpoints concernés, y compris les réglages des intégrations.
- [x] Exécuter `bun run check:all` avant les modifications de code et conserver le résultat de référence.
- [x] Capturer les écrans accessibles avec les données locales sur desktop et mobile, puis relever les parcours, requêtes et temps observés. Consigner les états absents et les erreurs préexistantes.
- [x] Définir les structures de `save`, `delete`, des opérations avec formulaire et des parcours de création.
- [x] Définir les champs techniques, les noms de soumission, les méthodes et paramètres d’endpoint, les valeurs vides et les contrôles exclus de la sauvegarde.
- [x] Définir la réponse attendue pour actualiser la lecture et le contrat exact du raccord déclaratif, y compris sa portée.
- [x] Définir la conservation des modifications, le traitement des conflits et les critères mesurables de stabilité et de performance.
- [x] Présenter les contrats retenus et les éventuelles décisions encore nécessaires, puis s’arrêter.

Livrables : [bilan et preuves](docs/quality/integration-views/step-1.md), [inventaire exhaustif](docs/quality/integration-views/inventory.md), [contrats détaillés](docs/quality/integration-views/contracts.md). Aucun contrat cible n’est encore implémenté.

### Étape 2 — Shell et migration de ses usages

- [x] Ajouter le slot `body` au shell et extraire la disposition principale/latérale dans le composant dédié.
- [x] Conserver les styles, espacements, largeurs, comportements sans aside et comportements responsive utiles de l’admin.
- [x] Migrer les usages dans les dashboards, intégrations, réglages, pages, utilisateurs, rôles, thème, fonctions et triggers selon l’inventaire.
- [x] Vérifier les associations bouton/formulaire, les slots et l’absence de formulaires imbriqués.
- [x] Comparer les captures, vérifier les débordements, la navigation et le défilement, puis corriger les régressions du lot.
- [x] Présenter les modifications et les vérifications, puis s’arrêter.

Livrable : [bilan de l’étape 2 et preuves](docs/quality/integration-views/step-2.md). Le seul échec du dernier `check:all` concerne le formatage de deux fichiers Mossa modifiés en parallèle, hors de cette étape.

### Étape 3 — Formulaires et binding génériques

- [ ] Raccorder les vrais contrôles à la soumission, avec un contrat commun pour les valeurs simples et structurées.
- [ ] Implémenter le raccord de succès à une source de lecture en s’appuyant sur `setSourceData()`.
- [ ] Raccorder la conservation des modifications locales et l’acquittement des seules valeurs effectivement enregistrées.
- [ ] Gérer les erreurs, les conflits, les doubles soumissions, les réponses tardives et les changements de fiche.
- [ ] Préserver les contrôles montés et limiter les mises à jour visuelles aux éléments concernés.
- [ ] Mettre à jour les exports, contrats, validation, compilation, édition et documentation touchés par les nouveaux attributs.
- [ ] Tester les formulaires ordinaires existants pour éviter de modifier implicitement leur comportement.
- [ ] Présenter les résultats et les limites restantes, puis s’arrêter.

### Étape 4 — Parcours produit complet

- [ ] Migrer la définition du produit vers la lecture commune, le formulaire principal et les opérations séparées.
- [ ] Implémenter la modal de création de brouillon, les valeurs par défaut métier et l’ouverture de la fiche créée.
- [ ] Vérifier les champs de `main` et `aside`, les affichages en lecture seule, les métadonnées et les variantes.
- [ ] Terminer la création indépendante depuis un lookup, avec sélection dans le brouillon du produit.
- [ ] Adapter le cycle des images et les endpoints pour valider leurs associations au Save, avec annulation et nettoyage.
- [ ] Implémenter la suppression si elle est autorisée par le domaine et vérifier les refus métier.
- [ ] Tester tout le parcours en navigateur et vérifier les données après relecture réelle.
- [ ] Présenter la fiche produit complète et ses preuves de validation, puis s’arrêter avant la généralisation.

### Étape 5 — Généralisation aux intégrations

- [ ] Passer toutes les intégrations officielles en revue et établir la liste exhaustive des définitions réellement concernées.
- [ ] Migrer les sauvegardes, suppressions, formulaires d’opérations et créations en réutilisant les contrats validés sur le produit.
- [ ] Déplacer les champs propres à une opération dans son formulaire, par exemple la raison d’un refus ou les informations de demande de prix.
- [ ] Adapter les endpoints et leurs réponses, les permissions et les règles de révision selon chaque intégration.
- [ ] Migrer les réglages utilisant ces widgets en conservant les sélecteurs de secrets, de pages et leurs comportements métier.
- [ ] Mettre à jour les ressources installées localement en préservant les données, réglages et références existantes.
- [ ] Vérifier les installations locales et les mises à jour pour éviter l’écrasement des valeurs enregistrées.
- [ ] Tester et capturer les écrans de chaque intégration migrée ; documenter les exceptions justifiées.
- [ ] Présenter le bilan de migration et les cas restants, puis s’arrêter.

### Étape 6 — Nettoyage et validation finale

- [ ] Supprimer les formulaires cachés intermédiaires et les chemins de collecte devenus inutiles après la migration.
- [ ] Retirer les anciens contrats remplacés et leurs usages, après vérification des consommateurs locaux.
- [ ] Actualiser la documentation et les règles ou diagnostics de `quality/ui-contracts` concernés.
- [ ] Exécuter les tests ciblés, la construction nécessaire aux tests navigateur et la vérification complète sur Courtside local.
- [ ] Comparer toutes les captures et mesures finales aux références ; résoudre les régressions du chantier.
- [ ] Exécuter le `check:all` final et expliquer les avertissements qui restent dans le périmètre.
- [ ] Fournir le bilan final des modifications, des vérifications et des limites, puis s’arrêter sans commit ni déploiement.

## 8. Vérification attendue à chaque lot

La validation ne se limite pas à la réussite d’une requête ou d’un test unitaire.

| Domaine | Scénarios attendus |
| --- | --- |
| Parcours nominal | Liste → création → fiche → modification → Save → relecture → réouverture → suppression lorsque disponible. |
| Persistance | Vérifier par une nouvelle lecture que les valeurs et associations enregistrées correspondent à la saisie. |
| Types et effacement | Booléens vrais/faux, zéro, nombres, valeurs vides, listes vides, objets imbriqués, suppressions de lignes et champs non éditables. |
| Actions | Action directe, confirmation, formulaire en modal, fermeture de succès, maintien de la saisie après erreur. |
| Modifications simultanées | Saisie pendant Save, champs modifiés avant une opération indépendante, conflit de révision et opération touchant un champ déjà édité. |
| Navigation | Changement de fiche ou fermeture pendant une requête, retour à la liste, identifiants de formulaires uniques, aucune réponse appliquée à une autre fiche. |
| Images et lookups | Ajout, retrait, remplacement, ordre, transfert échoué ou en cours, annulation, création de marque et sélection non encore sauvegardée. |
| Interface | Captures de chaque page affectée en desktop/mobile, comparaison avant/après, focus, curseur, scroll, modals, navbars et absence de débordements. |
| Performance | Nombre de lectures et mutations, délai du retour visuel, temps de sauvegarde et cas réseau lent. Fixer les budgets après mesure de référence et expliquer les écarts. |
| Fournisseurs externes | Simulations contrôlées pour les opérations nécessitant des clés. Distinguer explicitement ces tests d’un fonctionnement réel vérifié chez le fournisseur. |

Le cycle de chaque lot de code comprend un `check:all` avant et après, les tests adaptés, `bun run format` après modification JavaScript/TypeScript, la construction dans l’ordre du workspace et l’inspection du diff. Les erreurs introduites doivent être corrigées ; les avertissements restants dans le périmètre doivent être expliqués.

Les vérifications métier utilisent des données de test identifiables, un environnement isolé ou des fixtures locales. Elles ne doivent pas supprimer les vraies données importées pour la démo. Conserver des preuves de tests et des captures sans identifiants de connexion ni secrets.

Pour cette étape documentaire uniquement, la vérification du diff suffit. Les exemples ci-dessus décrivent une cible et ne constituent pas des exemples compilables du contrat actuel.

## 9. Points d’appui dans le code actuel

Ces références servent à retrouver les mécanismes examinés ; elles ne signifient pas que la cible décrite est déjà implémentée.

- [Contrats des widgets et des actions](packages/features/cms-dashboards/src/interfaces/dashboard/widgets.ts) et [contrats des champs](packages/features/cms-dashboards/src/interfaces/dashboard/fields.ts).
- [Template actuel du shell](packages/surfaces/cms-control/src/components/admin/Layout/ShellDetail/template.html) et [template du widget de détail](packages/surfaces/cms-control/src/components/admin/Resources/Dashboards/widgets/w-detail/WDetail/template.html).
- [Exemple existant d’association de champs et bouton à un formulaire](packages/surfaces/cms-control/src/static/admin/_content/pages/detail.html).
- [Formulaire caché intermédiaire actuel](packages/surfaces/cms-control/src/static/admin/_content/sources/_runtime/action-form.html).
- [Traitement actuel des actions](packages/surfaces/cms-control/src/components/admin/Resources/Dashboards/view/actions/index.ts) et [état des champs de la fiche](packages/surfaces/cms-control/src/components/admin/Resources/Dashboards/widgets/w-detail/runtime/fieldState.ts).
- [Actualisation des données d’une source](packages/foundation/components/src/binding/source/values.ts), [cycle de soumission](packages/foundation/components/src/binding/source/submission.ts) et [sérialisation des formulaires](packages/foundation/components/src/binding/submit/formSerialization.ts).
- [Tests des formulaires dans une source parente](packages/foundation/components/tests/binding/source/submit-trigger/nested.test.ts) et [tests des frontières de binding](packages/foundation/components/tests/binding/reactive/template.boundaries.test.ts).
- [Définition actuelle de la fiche produit](packages/resources/official-integrations/integrations/domains/commerce/definitions/artifacts/dashboards/products/views/product-detail.json).
- [Historique technique des migrations de widgets et de leurs vérifications](docs/quality/dashboard-widget-binding.md).
