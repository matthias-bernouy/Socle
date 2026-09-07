# Contrats de la refonte des vues — étape 1

Statut : contrat cible pour relecture, non implémenté. Le [plan principal](../../../REFACTOR_INTEGRATIONS_VIEW.md) définit le périmètre et les arrêts. Les noms introduits ici seront la référence des étapes suivantes ; ils ne décrivent pas des attributs actuellement disponibles.

## 1. Répartition des responsabilités

- `@bernouy/cms-dashboards` décrit et valide les fiches, champs et opérations, ainsi que les appels autorisés par un dashboard.
- `@bernouy/cms-integrations` parse les ressources des intégrations et conserve les contrats de leurs opérations de management.
- `@bernouy/cms-control` compose les fragments HTML, fournit les composants du shell, coordonne une fiche et sa navigation et utilise les événements du binding.
- `@bernouy/components` gère la lecture, les vrais formulaires, les valeurs des contrôles, la soumission et l’application d’une réponse à une source.
- L’intégration définit les endpoints, valeurs initiales, autorisations, révisions, validations métier et opérations chez les fournisseurs.

La composition peut calculer des chemins et créer la structure à partir d’une définition. Elle ne collecte pas les valeurs de toute la fiche pour fabriquer un autre formulaire ou un objet de requête parallèle. Les composants visuels utilisent les tokens de l’admin et gardent leur CSS dans leur shadow DOM. Le contenu bindé et les vrais formulaires restent dans le light DOM de la page.

## 2. Lecture et chemins des champs

Conserver `source: DashboardDataRef`, avec les références d’endpoint existantes et `itemPath` lorsqu’une réponse enveloppe la ressource. La source conserve la **réponse complète** ; `itemPath` sélectionne la ressource utilisée par les champs. Les données annexes restent accessibles pour les options et l’affichage.

Le `path` d’un champ est relatif à cette ressource. Il fournit aussi, par défaut, son chemin de soumission : `metadata.weight` produit un contrôle nommé `metadata[weight]`. `id` identifie le champ dans la définition et ne remplace pas son chemin de donnée.

Une propriété optionnelle `name` peut préciser un autre chemin de soumission pour un champ lorsque son nom d’édition diffère de son chemin de lecture. Elle correspond au nom d’un vrai contrôle HTML ; elle ne permet ni expressions ni construction arbitraire de corps. Les fiches migrées doivent privilégier des chemins cohérents plutôt qu’un renommage systématique.

Les réponses de lecture et d’écriture n’ont pas à utiliser la même URL. Pour appliquer directement une sauvegarde à la lecture, leurs **réponses complètes** doivent cependant avoir la même forme. Exemple : si la lecture renvoie `{ field: … }`, la sauvegarde renvoie aussi cette enveloppe, et non uniquement son contenu.

## 3. Formulaire de sauvegarde

Ajouter `save` optionnel sur `w-detail`. Son endpoint reçoit les valeurs des contrôles éditables du formulaire principal et ses paramètres techniques. Il ne reçoit pas automatiquement les champs en lecture seule ou les propriétés annexes de la source.

Exemple cible pour le produit, avec la convention de version déjà utilisée par Commerce :

```json
{
  "save": {
    "endpoint": "upsertProduct",
    "label": "Save product",
    "hiddenFields": [
      { "name": "id", "value": "$resource.id", "type": "string" },
      { "name": "expectedVersion", "value": "$resource.version", "type": "number" }
    ]
  }
}
```

Contrat de l’opération de formulaire :

- `endpoint` : identifiant de l’endpoint déclaré ; `sourceId` optionnel pour une autre source autorisée.
- `management` : alternative exclusive à `endpoint`, réutilisant l’identifiant d’installation et l’action de management existants. Les endpoints ordinaires ne servent pas à contourner le service de management.
- `label`, `icon`, `tone` et `confirm` : présentation et éventuelle confirmation, avec les conventions actuelles.
- `hiddenFields` : liste de paramètres scalaires provenant de `$resource`, du contexte de sélection stable ou de constantes. Aucune référence `$field` et aucun objet ou tableau sérialisé dans ces champs.
- `valuesPath` optionnel : préfixe commun des seuls champs éditables, par exemple `values` pour les réglages. Il produit `values[country]` ; les champs techniques gardent leur propre chemin.
- `refresh` : `response`, `read` ou `none`. Par défaut `response` pour Save. Cette valeur est explicite pour les opérations indépendantes selon leur effet réel.

La méthode HTTP vient de l’endpoint déclaré. Pour les mutations migrées, placer l’identité métier et la révision dans les champs techniques du corps. Les 23 endpoints de mutation référencés qui déclarent aujourd’hui des paramètres devront être examinés : adapter leur contrat et leur connecteur lorsque ces paramètres représentent la ressource à modifier. Le sélecteur d’endpoint du proxy et l’identifiant d’installation de management restent des paramètres d’infrastructure.

`hiddenFields[].type` vaut `string`, `number` ou `boolean`. Une valeur technique requise absente empêche la soumission avec une erreur de configuration compréhensible. La création possède son propre formulaire et n’a pas à fabriquer un identifiant ou une révision inexistants. Un champ caché et un champ éditable ne peuvent pas écrire le même chemin.

Pour `management.action = "save-settings"`, le formulaire peut envoyer les champs éditables sous `values` et la révision sous `expectedRevision`. Pour une action déclarée de management, l’adaptation conserve `actionId` et l’enveloppe `input` attendue par le service. Ces enveloppes sont connues à la composition du formulaire ; elles ne sont pas reconstituées depuis un JSON attaché au widget.

## 4. Soumission des valeurs et effacement

Introduire un mode explicite `cms-source-serialization="typed-json"` pour les formulaires concernés. Les formulaires existants sans cet attribut gardent leur sérialisation actuelle, notamment les formulaires publics et les uploads multipart.

Le mode typé sérialise les contrôles du vrai formulaire, y compris ceux associés par `form="…"`. Il ne récupère pas un objet de payload depuis le contexte de la fiche.

| Contrôle ou valeur | Valeur JSON soumise |
| --- | --- |
| Texte, textarea, référence de secret ou de page | Chaîne ; une référence de secret n’est jamais sa valeur résolue. |
| Nombre ou montant | Nombre fini après la conversion propre au contrôle ; un montant conserve la convention d’unité déclarée. |
| Checkbox booléenne | `true` ou `false`, y compris lorsqu’elle est décochée. La validation `required` du contrôle reste une règle distincte. |
| Select | Chaîne par défaut ; conversion explicite si le champ déclare `valueType: "number"` ou `"boolean"`. |
| Multi-select ou tokens | Tableau, y compris `[]`. |
| Table ou liste éditable | Tableau de valeurs structurées ; `[]` signifie vider cette collection. |
| Métadonnées éditables | Objet des valeurs éditables ; traiter explicitement les clés non exposées et les effacements. |
| Valeur optionnelle vide | Politique déclarée : chaîne vide, `null` ou omission. Aucune conversion arbitraire de la chaîne `"null"`. |
| Lecture seule, contrôle sans nom ou désactivé | Exclu de la soumission. |
| Fichier binaire dans un formulaire `typed-json` | Erreur explicite ; utiliser le formulaire d’upload multipart et soumettre ensuite ses références. |

Pour les contrôles natifs dont le type HTML ne suffit pas, utiliser `cms-form-value-type="string|number|boolean"`. `cms-form-empty="null|omit"` exprime une politique de vide spécifique ; sans cet attribut, les textes restent des chaînes vides et les nombres facultatifs vides sont omis. Une valeur numérique ou booléenne invalide bloque l’envoi. Ces attributs sont génériques et ne contiennent pas de schéma JSON.

Les composants associés aux formulaires exposent un contrat typé commun, proposé sous la forme `getFormValue()`, pour retourner leur valeur éditable naturelle. Les composants structurés possèdent leur propre valeur de contrôle, comme une liste de références ou des lignes éditées. Ils continuent à participer aux formulaires natifs avec `ElementInternals` ; le mode typé utilise cette valeur commune sans la convertir en texte JSON dans le DOM. La lecture reste assurée par `cms-bind-value` et `setBindingValue()`.

Le collecteur générique considère un contrôle structuré comme une seule contribution. Il ne collecte pas aussi ses contrôles internes ; ceux-ci ne doivent pas être associés séparément au même formulaire sous les mêmes noms. Ce contrat ne doit pas devenir une méthode permettant à un widget de retourner arbitrairement toute la fiche.

Les noms imbriqués utilisent les crochets. Le mode typé doit produire de vrais tableaux pour les indices numériques, rejeter les collisions scalaire/objet et les segments dangereux, et éviter les ambiguïtés entre deux contrôles du même nom. Il ne change pas rétroactivement le traitement actuel des noms contenant des points.

Pour les champs conditionnels, la visibilité seule n’est pas une politique métier d’effacement. Conserver les contrôles des champs éditables masqués afin de préserver et soumettre leur saisie, en les retirant de l’interaction. Suspendre leurs contraintes de validation interactive tant qu’ils sont masqués, sans les désactiver ; les règles métier restent vérifiées par l’endpoint. La lecture seule et l’état HTML `disabled` excluent explicitement une valeur de la soumission. Le montage conditionnel destructif ne doit pas être utilisé pour un brouillon qui doit survivre. Ce premier contrat n’ajoute pas de politique déclarative distincte d’exclusion des champs masqués : `visibleWhen` seul n’exclut pas une valeur.

Les endpoints préservent les propriétés non soumises. Pour un groupe structuré soumis, la sémantique est définie au niveau de ce groupe : une liste est remplacée comme une unité ; un objet de métadonnées met à jour les clés éditables fournies et conserve les clés non exposées. Une valeur `null` vide une clé nullable ; un effacement non nullable nécessite une représentation ou une opération explicitement définie. Un objet vide n’efface donc pas implicitement toutes les métadonnées cachées.

## 5. Opérations indépendantes et suppression

Les actions existantes conservent leurs identifiants, conditions et présentation. Une action de mutation utilise le même contrat de formulaire que Save, avec des `fields` optionnels propres à l’opération. Des champs supplémentaires ouvrent une modal ; une confirmation seule ouvre une modal de confirmation ; sans l’un ni l’autre, le bouton soumet directement son formulaire.

```json
{
  "id": "requestPrice",
  "label": "Request seller price",
  "endpoint": "reviewOffer",
  "hiddenFields": [
    { "name": "id", "value": "$resource.id", "type": "string" },
    { "name": "expectedVersion", "value": "$resource.version", "type": "number" },
    { "name": "action", "value": "request_price", "type": "string" }
  ],
  "fields": [
    { "id": "minimumAmount", "path": "minimumAmount", "label": "Minimum amount", "type": "money" },
    { "id": "maximumAmount", "path": "maximumAmount", "label": "Maximum amount", "type": "money" },
    { "id": "reason", "path": "reason", "label": "Reason", "type": "textarea" }
  ],
  "refresh": "response"
}
```

Les détails propres au montant, à la devise et à sa validation reprennent le contrat du contrôle existant ; cet exemple illustre la séparation des formulaires. Ces champs quittent le formulaire principal de l’offre.

`delete` reprend la cible et les champs techniques de formulaire avec une confirmation obligatoire. Il n’est pas rendu pour une création non enregistrée. Au succès HTTP `2xx`, y compris `204`, fermer le détail et invalider sa liste. La navigation `after.opens` / `after.row` existante reste disponible pour revenir au parent d’une section ou d’une question. Une suppression n’applique pas sa réponse comme nouvelle fiche.

Ne pas inventer un `deleteProduct` : cet endpoint n’existe pas dans Commerce aujourd’hui. Le produit conserve l’archivage ; la suppression standard sera validée sur une ressource qui possède une vraie suppression, par exemple une marque non référencée. Toute extension métier de suppression du produit doit être décidée séparément.

Les opérations de publication de versions immuables, d’archivage, de paiement ou d’envoi restent explicites. Un téléchargement et un lien de navigation gardent leur nature propre. Les actions qui ne renvoient pas une fiche complète déclarent `refresh: "read"` lorsqu’une relecture du détail est nécessaire.

## 6. Création

Ajouter `create` optionnel sur le widget de collection qui propose la création (`w-table` ou `w-navigation-list`). Il référence le détail de destination et utilise le même contrat de formulaire. Son choix de présentation est explicite : `modal` ou `page`.

```json
{
  "create": {
    "label": "Create product",
    "mode": "modal",
    "view": "productDetail",
    "rowPath": "id",
    "source": { "endpoint": "newProduct" },
    "endpoint": "createProduct",
    "submitLabel": "Create draft",
    "fields": [
      { "id": "title", "path": "title", "label": "Title", "type": "text", "required": true }
    ]
  }
}
```

`newProduct` et `createProduct` sont des endpoints à ajouter, pas des endpoints actuellement présents. `source` est facultative lorsque la création n’a pas besoin d’une lecture de valeurs initiales. `fields` réutilise le contrat des champs, sans imposer que la création et l’édition aient les mêmes champs requis. Le mode `page` peut aussi utiliser des sections principales et latérales.

Au succès, `rowPath` extrait l’identité depuis la réponse, ouvre `view` et fournit la réponse complète à sa source. Si une modal suffit à toute l’opération, la destination peut être omise : actualiser la liste puis fermer la modal. L’absence de destination et celle d’identité nécessaire à une navigation sont validées explicitement.

Pour le produit : générer le slug unique côté intégration, appliquer `draft` et `hidden`, puis ouvrir la fiche persistée. Les règles de complétude nécessaires à la publication doivent être distinguées des exigences minimales de création d’un brouillon ; les métadonnées requises par une catégorie ne doivent pas empêcher de créer le brouillon minimal prévu. L’endpoint reste responsable de ces décisions.

Les créations de sections et questions de Forms, déjà effectuées par des endpoints dédiés, réutilisent leurs paramètres de parent dans les champs techniques. `openSettings` de Delivery est une navigation vers un singleton, pas une création : supprimer l’ambiguïté avec le chemin générique `__new__` lors de la migration.

Le lookup créateur réutilise le même formulaire. Il enregistre sa ressource indépendamment puis sélectionne son identité dans le contrôle appelant. Il ne soumet pas le formulaire principal, ne le marque pas enregistré et ne supprime pas la ressource créée si l’utilisateur abandonne ensuite sa fiche.

## 7. Application de réponse et protection des modifications

Retenir `cms-source-success-update="#source-id"`. La cible est un identifiant unique de source de lecture automatique situé dans le même `cms-binding-core`. Pas de sélection ambiguë, de ciblage d’un autre core ni de cible qui soit un formulaire de soumission.

- Résoudre la cible au départ de la soumission et capturer son instance et sa génération de lecture.
- Accepter uniquement une réponse JSON complète compatible avec la source cible. Une réponse vide ou un succès sans JSON ne vide pas la fiche et produit un diagnostic. Valider le schéma lorsqu’il est déclaré ; sans schéma, la compatibilité métier relève du contrat et des tests de l’intégration. Le binding ne peut pas la déduire en comparant les clés de deux objets.
- Appliquer `result.body` avec `setSourceData()` après un succès et avant de publier les effets de succès, de fermer une modal ou de naviguer.
- Garder la source affichée dans son état chargé et mettre à jour ses bindings en place. `cms-source-success-reset="false"` est utilisé pour les fiches.
- Si la cible a été remplacée, si sa sélection ou son URL a changé, ignorer l’application locale de l’ancienne réponse. Une simple identité DOM ne suffit pas si l’élément est réutilisé pour une autre ressource.
- Une erreur métier ou réseau ne remplace pas la source. Un timeout ne prouve pas que le serveur n’a rien enregistré ; proposer une vérification avant de répéter une opération non idempotente.

Pour `refresh: "read"`, relire uniquement la source concernée en conservant la fiche affichée. Ne pas diffuser une relecture globale des dashboards. Si la mutation réussit mais que cette relecture échoue, afficher ces deux résultats distinctement et permettre de relire sans rejouer la mutation.

Le cycle typé conserve trois informations par contrôle : valeur de référence, valeur envoyée et saisie courante. Un champ soumis resté identique à sa valeur envoyée reçoit la valeur normalisée du serveur et devient enregistré. Un champ modifié depuis l’envoi reste édité. Les paramètres techniques suivent la réponse acceptée.

Pour une autre opération, un champ localement intact reçoit la nouvelle référence. Une saisie locale inchangée côté serveur est conservée. Si la référence serveur et la saisie ont changé différemment, conserver la saisie, afficher le conflit et demander un choix entre la valeur enregistrée et la saisie avant un nouvel envoi. Une valeur déjà identique au résultat serveur n’est pas un conflit. Les listes structurées sont comparées comme une unité dans ce premier contrat ; aucune fusion automatique par ligne n’est promise.

Le contrôleur de fiche de Control coordonne une mutation à la fois pour la même ressource et conserve la navigation. Le binding gère le cycle du formulaire et ses valeurs, sans connaissance de `expectedVersion` ou du domaine. Les autres fiches et les formulaires ordinaires restent indépendants.

Conserver la référence des valeurs structurées inchangées afin de ne pas remonter inutilement leurs répétitions. L’ajout d’une réconciliation générale par `key` reste exclu. Les limites mesurées des répétitions ou des contrôles structurés doivent être signalées si elles empêchent les critères de stabilité.

## 8. Adaptations métier identifiées

| Cas | Adaptation nécessaire |
| --- | --- |
| Produit | Identité actuellement dans la query, `expectedVersion` numérique dans le corps ; réponse complète déjà disponible. Ajouter la création minimale et le cycle des images en attente. |
| Images du produit | Les endpoints actuels attachent, retirent et réordonnent immédiatement. Définir des références de fichiers en attente, une validation finale des associations et un nettoyage ; les URLs et métadonnées de stockage ne deviennent pas des paramètres de confiance. |
| Forms, sauvegarde de formulaire | `draftDefinition` est actuellement repris depuis `$resource`. L’endpoint doit préserver le brouillon de sections/questions lorsqu’on sauvegarde uniquement les réglages de la fiche. Ne pas envoyer cette définition en JSON caché. |
| Emailer | `metadata` est actuellement repris depuis `$resource` ; préserver ces propriétés côté endpoint. Le JSON éditable de `sampleDataJson` est un contenu métier explicite, pas un transport de widgets à supprimer. |
| Profil utilisateur | Préserver les références d’avatar non éditées sans les recopier artificiellement dans le corps de chaque sauvegarde. |
| Champs utilisateur | Réponse enveloppée dans `field`, plusieurs booléens affichés par des selects : conserver l’enveloppe et déclarer leur type de valeur. |
| Réglages de connexion | Préserver les propriétés non exposées actuellement conservées par la copie de `settings.values`. Déplacer cette responsabilité au contrat de sauvegarde de l’intégration. |
| Réglages enregistrés mais non appliqués | Le service actuel peut échouer après persistance lors de l’application. Le résultat doit distinguer la révision enregistrée et l’état d’application, ou permettre leur relecture sans répéter aveuglément Save. La gestion du fournisseur reste dans l’intégration. |
| Consent et conditions vendeur | Conserver les publications immuables, preuves et confirmations. Ne pas transformer une publication de version en écrasement silencieux. |
| Politique C2C | La publication crée une nouvelle révision ; préférer une création complète adaptée à ses nombreux champs plutôt qu’un petit formulaire modal imposé. |
| Révisions spécialisées | Conserver `expectedSettingsVersion`, `expectedSettlementVersion`, `expectedInterventionRevision`, les identités composites et les jetons d’opération déclarés par leurs domaines. |

Les contrats d’endpoint, leurs validateurs, les parseurs des définitions, le calcul des appels autorisés et leurs tests doivent être migrés ensemble. Le système générique ne doit pas rendre accessible une action ou une autre source uniquement parce qu’un formulaire a été ajouté au HTML.
