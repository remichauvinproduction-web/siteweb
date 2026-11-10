# Téléversement manuel — galeries Rémi PRODUCTION

## 1. Mettre les fichiers du site dans GitHub

1. Ouvrir `remichauvinproduction-web/siteweb` sur GitHub et créer une branche depuis `main`.
2. Utiliser **Add file > Upload files** et déposer les fichiers du dossier `galerie-remiproduction` en conservant leurs chemins relatifs à la racine du dépôt.
3. Vérifier les chemins dans l’aperçu, puis valider le commit sur la branche et fusionner la branche quand elle est prête.
4. Si Cloudflare Pages est relié à ce dépôt, il redéploie le site depuis la branche de production après fusion.

Le ZIP fourni contient seulement les fichiers ajoutés/modifiés pour cette fonctionnalité, pas une copie complète du site. Ne le téléversez pas comme déploiement Direct Upload d’un nouveau projet Pages.

## 2. Configurer les sous-domaines Cloudflare

Suivre `cloudflare/README.md` dans le ZIP. Avant de créer le DNS wildcard, relever le domaine `*.pages.dev` exact du projet Pages et examiner les DNS/Workers existants. Le routeur doit être publié avec la variable `PAGES_ORIGIN` réglée sur ce nom Pages.

La configuration DNS attendue est `CNAME * -> <projet>.pages.dev`, avec proxy Cloudflare activé. La route Worker est `*.remiproduction.fr/*`.

## 3. Créer une galerie

Après le déploiement, ouvrir `https://remiproduction.fr/admin`, choisir **Galeries clients**, créer la galerie et publier les photos. Le slug issu du nom fournit les liens `/galerie/slug` et `https://slug.remiproduction.fr/`.

Les galeries sont publiques pour toute personne qui possède le lien ; aucun mot de passe n’est configuré.
