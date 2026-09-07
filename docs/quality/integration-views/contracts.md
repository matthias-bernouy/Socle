# Contrats de la refonte des vues — étape 1

Statut : contrats métier cibles pour les étapes 4 et 5 ; le shell et les primitives génériques de formulaire/relecture sont implémentés aux étapes 2 et 3. Le [plan principal](../../../REFACTOR_INTEGRATIONS_VIEW.md) définit le périmètre et les arrêts. Les sections 4 et 7 décrivent le binding actuel ; les définitions métier restent à migrer.

## 1. Répartition des responsabilités

- `@bernouy/cms-dashboards` décrit et valide les fiches, champs et opérations, ainsi que les appels autorisés par un dashboard.
- `@bernouy/cms-integrations` parse les ressources des intégrations et conserve les contrats de leurs opérations de management.
- `@bernouy/cms-control` compose les fragments HTML, fournit les composants du shell, coordonne une fiche et sa navigation et utilise les événements du binding.
- `@bernouy/components` gère la lecture, les vrais formulaires, les valeurs des contrôles, la soumission et la relecture ciblée après succès.
- L’intégration définit les endpoints, valeurs initiales, autorisations, révisions, validations métier et opérations chez les fournisseurs.

La composition peut calculer des chemins et créer la structure à partir d’une définition. Elle ne collecte pas les valeurs de toute la fiche pour fabriquer un autre formulaire ou un objet de requête parallèle. Les composants visuels utilisent les tokens de l’admin et gardent leur CSS dans leur shadow DOM. Le contenu bindé et les vrais formulaires restent dans le light DOM de la page.

## 2. Lecture et chemins des champs

Conserver `source: DashboardDataRef`, avec les références d’endpoint existantes et `itemPath` lorsqu’une réponse enveloppe la ressource. La source conserve la **réponse complète** ; `itemPath` sélectionne la ressource utilisée par les champs. Les données annexes restent accessibles pour les options et l’affichage.

Le `path` d’un champ est relatif à cette ressource. Il fournit aussi, par défaut, son chemin de soumission : `metadata.weight` produit un contrôle nommé `metadata[weight]`. `id` identifie le champ dans la définition et ne remplace pas son chemin de donnée.

Une propriété optionnelle `name` peut préciser un autre chemin de soumission pour un champ lorsque son nom d’édition diffère de son chemin de lecture. Elle correspond au nom d’un vrai contrôle HTML ; elle ne permet ni expressions ni construction arbitraire de corps. Les fiches migrées doivent privilégier des chemins cohérents plutôt qu’un renommage systématique.

Pour une table éditable, `rowKey` peut désigner un chemin scalaire d’identité métier à conserver lors de la sauvegarde, par exemple `key` pour un axe de variantes existant. La composition ajoute un contrôle caché technique dans chaque ligne ; le contrôle de table soumet cette seule identité avec les cellules éditables, sans recopier l’objet serveur complet. Une nouvelle ligne sans identité omet cette valeur. `rowKey` ne peut pas recouvrir une colonne éditable : l’intégration conserve les propriétés non éditées en retrouvant la ligne par cette identité. Il ne s’agit pas d’une clé de rendu ni d’un nouveau mécanisme de réconciliation du binding.

Les réponses de lecture et d’écriture n’ont pas à utiliser la même URL. Leurs réponses n’ont pas non plus à partager une forme : après succès, la source de lecture est relue. Un succès HTTP 204 est accepté.

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
| Multi-select natif | Tableau, y compris `[]`. |
| Tokens existants | Chaîne séparée par des virgules ; conversion en tableau seulement si explicitement prévue. |
| Table ou liste éditable | Tableau de valeurs structurées ; `[]` signifie vider cette collection. |
| Métadonnées éditables | Objet des valeurs éditables ; traiter explicitement les clés non exposées et les effacements. |
| Valeur optionnelle vide | Politique déclarée : chaîne vide, `null` ou omission. Aucune conversion arbitraire de la chaîne `"null"`. |
| Lecture seule, contrôle sans nom ou désactivé | Exclu de la soumission. |
| Fichier binaire dans un formulaire `typed-json` | Erreur explicite ; utiliser le formulaire d’upload multipart et soumettre ensuite ses références. |

Pour les contrôles natifs dont le type HTML ne suffit pas, utiliser `cms-form-value-type="string|number|boolean"`. `cms-form-empty="null|omit"` exprime une politique de vide spécifique ; sans cet attribut, les textes restent des chaînes vides et les nombres facultatifs vides sont omis. Une valeur numérique ou booléenne invalide bloque l’envoi. Ces attributs sont génériques et ne contiennent pas de schéma JSON.

Les composants associés aux formulaires conservent leur contrat existant : propriété `value`, état `checked` pour les contrôles booléens et participation native via `ElementInternals.setFormValue()`. Aucun `getFormValue()` ni nouveau `setBindingValue()` n’est requis. Le binding renseigne les propriétés existantes avec l’interpolation habituelle.

Le champ de tokens existant expose une chaîne séparée par des virgules dans `value` et dans sa contribution au formulaire. Il conserve ce format. Une éventuelle conversion vers un tableau doit être explicite et compatible avec ce contrôle ; aucune chaîne ordinaire n’est découpée automatiquement. Le multi-select natif, lui, expose plusieurs valeurs sélectionnées. Les listes et objets éditables se composent à partir de contrôles nommés ; un widget ne doit pas retourner arbitrairement toute la fiche. Les contrôles associés au formulaire sont collectés selon leur association effective, sans exclure leurs descendants sur la seule base de leur imbrication visuelle.

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
  "refresh": "read"
}
```

Les détails propres au montant, à la devise et à sa validation reprennent le contrat du contrôle existant ; cet exemple illustre la séparation des formulaires. Ces champs quittent le formulaire principal de l’offre.

`delete` reprend la cible et les champs techniques de formulaire avec une confirmation obligatoire. Il n’est pas rendu pour une création non enregistrée. Au succès HTTP `2xx`, y compris `204`, fermer le détail et invalider sa liste. La navigation `after.opens` / `after.row` existante reste disponible pour revenir au parent d’une section ou d’une question. Une suppression n’applique pas sa réponse comme nouvelle fiche.

Ne pas inventer un `deleteProduct` : cet endpoint n’existe pas dans Commerce aujourd’hui. Le produit conserve l’archivage ; la suppression standard sera validée sur une ressource qui possède une vraie suppression, par exemple une marque non référencée. Toute extension métier de suppression du produit doit être décidée séparément.

Les opérations de publication de versions immuables, d’archivage, de paiement ou d’envoi restent explicites. Un téléchargement et un lien de navigation gardent leur nature propre. Les actions qui nécessitent une actualisation relisent la source du détail après succès.

## 6. Création et édition d’une même fiche

Une création réutilise la définition du détail, sa source commune, ses sections, ses champs et son unique `save`. Le détail déclare la capacité `create: {}` (avec `label` et `title` facultatifs). Sa source GET accepte l’absence d’identité et renvoie des valeurs initiales sans créer de ressource persistée. L’intégration fournit les valeurs par défaut métier ; elle peut fournir un jeton scalaire de création pour rendre les nouvelles sauvegardes idempotentes.

La collection (`w-table` ou `w-navigation-list`) référence ce détail :

```json
{
  "create": {
    "viewId": "productDetail",
    "presentation": "page",
    "label": "Create product"
  }
}
```

`presentation` vaut `page` ou `modal`. `dashboardId` facultatif désigne un autre dashboard ; son absence vise le dashboard courant. Les références locales sont validées contre un détail possédant `save` et `create`. Les références entre dashboards sont résolues et contrôlées contre le catalogue installé lors du montage. Un identifiant absent, une cible inexistante ou une capacité absente doit produire une erreur explicite.

Les anciens objets de création `endpoint`, `fields`, `body`, `mode`, `opens` et `rowPath` sont refusés. Aucun formulaire de création parallèle ne subsiste dans la définition. Une modal monte le même détail qu’une page, y compris son contexte de lecture et ses contrôles complexes.

Les champs techniques de Save peuvent utiliser `empty: "omit"` pour l’identité et la révision absentes avant la première sauvegarde. Les autres champs techniques restent requis. La même cible de sauvegarde reçoit le brouillon de création ou la fiche existante. La réponse de création doit contenir son identité scalaire à `save.idPath` (défaut `id`) : elle sert à relire le détail persisté, sans fusionner la réponse de mutation avec les données affichées. Un `204` demeure possible pour une mise à jour, mais ne fournit pas l’identité nécessaire à la première création.

Un lookup `create` ou `edit` référence aussi ce détail ; les raccourcis de lookup utilisent uniquement `presentation: "modal"`, avec `valuePath` et `labelPath` explicites. Par exemple :

```json
{
  "create": {
    "dashboardId": "taxonomy",
    "viewId": "brandDetail",
    "presentation": "modal",
    "valuePath": "id",
    "labelPath": "name"
  }
}
```

La marque est sauvegardée indépendamment, puis sélectionnée dans le contrôle appelant ; le formulaire du produit reste un brouillon. L’édition utilise la sélection existante et exige une cible avec `save`, sans exiger la capacité `create`.

### Médias avant la première sauvegarde

Un champ `media` avec `persist: "save"` et une action `upload` déclare `staging: { "sessionField": "uploadSessionId" }`. Le staging est paresseux : le premier upload crée une session, sans produit provisoire. Le contrat multipart utilise la query `sessionId` facultative et répond `{ "sessionId": "…", "media": { "id": 123 } }`. Les uploads suivants réutilisent cette session ; les previews passent par l’endpoint déclaré et cette session.

Le contrôle contribue au vrai formulaire son tableau ordonné d’identités (`name: "mediaIds"`, par exemple) et le champ technique scalaire de session. Save attache les médias à la ressource créée ou modifiée. Le contrat de session ne transporte pas de JSON dans les attributs et n’ajoute pas de projection arbitraire de réponse. Les noms de session sont validés comme les autres noms de formulaire, notamment contre les collisions.

### Opérations indépendantes

Les formulaires d’opérations indépendantes avec `fields` conservent leur contrat propre. Leur modal simple ne monte pas un détail complet : les contrôles complexes ou dépendant d’une autre lecture y restent refusés explicitement. Cette limite ne concerne pas une création ou édition modale de détail. `save.refresh` accepte uniquement `read` ; une opération indépendante peut utiliser `refresh: "none"` lorsqu’elle ne modifie pas la fiche.

## 7. Relecture après sauvegarde et protection des modifications

Décision révisée après l’étape 2 : aucune application directe de la réponse de mutation. `cms-source-success-reload="#source-id"` cible un identifiant unique de source automatique du même core. Le runtime vérifie l’instance, l’URL et la génération de sélection ; une réponse tardive ne doit pas modifier une autre fiche.

Capturer les valeurs avant de verrouiller l’édition. Attendre la mutation puis le GET ciblé, en conservant les contrôles montés. Les valeurs normalisées sont appliquées au formulaire sauvegardé, y compris lorsque la réponse de lecture est identique à celle d’avant la saisie. Le formulaire n’est pas réinitialisé par défaut lorsqu’il déclare cette relecture ; un réglage explicite reste prioritaire.

La relecture conserve les données affichées et expose `refreshing` puis éventuellement `refreshError` sur l’état de la source de lecture. Une erreur de mutation conserve la saisie. Une mutation réussie suivie d’une erreur de lecture émet `cms-source:refresh-failed` avec `ok: true` et `refresh.ok: false`, sans lancer les effets ordinaires de succès. Le feedback de relecture suit la source de lecture ; un retry GET le fait disparaître sans rejouer la mutation.

Les conflits métier HTTP 409 sont traités comme des erreurs de sauvegarde et conservent le brouillon. Il n’y a pas de saisie concurrente pendant Save ni de fusion à trois versions. Pour les opérations indépendantes, le brouillon principal reste intact lorsque ses bindings serveur ne changent pas. Lors de la migration métier, une opération qui peut modifier les mêmes champs devra faire résoudre le brouillon avant de démarrer : le binding ne promet pas de fusion entre un brouillon et des champs changés par une autre opération.

Les branches JSON inchangées conservent leur référence et les éléments répétés inchangés à la même position restent montés. Une ligne déplacée ou modifiée peut être remontée. Aucun attribut `key`, mécanisme de recherche d’identité ou transport de valeurs structurées par une méthode de composant n’est introduit.

La sérialisation typée et la relecture ciblée sont documentées dans [le contrat du binding](../../blocs/data-bindings.md). Les définitions métier, la création et les médias seront migrés aux étapes 4 et 5.

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
