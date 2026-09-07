# Vérification de la fiche unique sur Courtside local

Date : 7 septembre 2026. Aucune modification de production, aucun commit.

## Problème réellement installé

L’erreur `The detail view commerce-products/undefined is unavailable.` provenait d’un décalage entre le bundle admin et les définitions stockées dans Mongo local. `productsTable.create` contenait encore `mode`, `endpoint`, `fields` et `opens`, alors que le nouveau rendu attend `viewId` et `presentation`. Le lookup marque avait également son ancienne définition.

Les tests précédents utilisaient le bundle et les nouvelles définitions officielles avec des réponses HTTP simulées. Ils ne couvraient pas la configuration encore installée sur `localhost:5200`. Le clic et l’ancienne configuration ont été vérifiés sur cette instance avant correction.

## Correction locale

- Mise à jour ciblée des widgets de `commerce-products` et `commerce-taxonomy`, en conservant les métadonnées, origines, réglages et autres dashboards.
- Mise à jour coordonnée de 11 contrats d’endpoints, du SQL concerné et de 10 fichiers Edge Commerce.
- Renommage de l’ancienne table de staging en archive locale protégée, avant création du stockage par session. Les uploads 169 et 170, leurs métadonnées et leurs fichiers sont conservés. L’archive est exclue du nettoyage automatique et inaccessible aux rôles API.
- Aucun ajout de compatibilité au binding ni réintroduction de l’API expérimentale.

Sauvegardes locales :

- `/tmp/cmscore-local-views-1788809427198/` : deux dashboards avant mise à jour.
- `/tmp/cmscore-product-endpoints/local-session-backup-1788809370045/` : schéma/données Commerce, source, fonctions et fichiers Edge précédents ; preuves avant/après.

## Parcours effectués dans le vrai navigateur

Les essais ci-dessous utilisent `http://localhost:5200`, ses endpoints réels et son Supabase local. Aucune interception ou simulation HTTP.

1. Liste des produits → `Create product` → fiche avec valeurs initiales.
2. Saisie du titre et de la description.
3. `+` marque → fiche complète en modal → création enregistrée → fermeture et sélection dans le produit.
4. Crayon → modification de cette marque → Save et relecture → libellé actualisé, brouillon produit conservé.
5. Transfert réel d’une image PNG avant la création du produit.
6. Save produit → création avec l’image et la marque → navigation vers l’identifiant reçu → GET.
7. Modification du titre → Save → nouvelle révision → rechargement complet de la page et vérification des données et de l’image.
8. Vérification du rendu mobile, de l’absence de débordement et des formulaires imbriqués.
9. Dans la taxonomie : création, modification et suppression d’une catégorie via ses vrais formulaires.

Résultats : toutes les mutations citées et leurs lectures ont répondu 200. Création produit et relecture mesurées à environ 226 ms sur cet essai. Zéro erreur JavaScript, zéro formulaire imbriqué, aucun débordement horizontal à 390 px. Le brouillon du produit et son champ titre ont été conservés pendant les modals marque.

Les ressources QA identifiées (produit 573, marque 19, média 173 et catégorie 7) ont été supprimées après vérification. Le fichier de test a été supprimé via l’API Storage. Les empreintes des tables `products`, `brands`, `categories`, `media` et `product_media` correspondent à celles d’avant le déploiement ; seules les séquences ont avancé. L’archive 169/170 est identique et les deux fichiers restent lisibles.

## Preuves

- `/tmp/cmscore-local-unified-flow.json` : identifiants des ressources QA, statuts, relectures et mesure du parcours produit.
- `/tmp/cmscore-local-category-proof.json` : création de la catégorie QA, ensuite supprimée via l’interface.
- `/tmp/cmscore-product-endpoints/unified-test-cleanup-proof.json` : nettoyage ciblé et conservation des données préexistantes.
- Captures inspectées : `/tmp/cmscore-local-brand-modal.png`, `/tmp/cmscore-local-product-before-save.png`, `/tmp/cmscore-local-product-saved.png`, `/tmp/cmscore-local-product-mobile.png`, `/tmp/cmscore-local-category-saved.png`.

La limite visuelle de la première navigation reste celle décrite dans [le bilan du retrait de l’API](creation-navigation.md) : une première création ouvre une nouvelle instance de la fiche et peut montrer le chargement pendant son GET. La généralisation des autres dashboards de l’étape 5 reste un chantier distinct.
