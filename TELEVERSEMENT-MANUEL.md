# Téléversement manuel — galeries Rémi PRODUCTION

## 1. Publier les fichiers du site

1. Téléchargez et décompressez `galerie-remiproduction-upload.zip`.
2. Dans GitHub, ouvrez `remichauvinproduction-web/siteweb`, créez une branche depuis `main`, puis choisissez **Add file > Upload files**.
3. Déposez les fichiers décompressés à la racine du dépôt en gardant les chemins (par exemple `admin/config.yml`, `assets/js/galerie.js`, `cloudflare/galerie-router.js`). Validez le commit puis fusionnez la branche dans `main`.
4. Cloudflare Pages est relié au dépôt `siteweb` : attendez la fin du déploiement.

Le ZIP contient seulement les nouveaux fichiers et ceux modifiés pour cette fonctionnalité. Ce n’est pas une copie complète du site à déposer dans un nouveau projet Pages.

## 2. Créer la base des e-mails

Dans Cloudflare, ouvrez **Storage & databases > D1 SQL Database > Create** et créez `galeries-remiproduction`. Dans sa console SQL, collez le fichier `cloudflare/migrations/0001_gallery_download_emails.sql`.

## 3. Publier le Worker

Dans **Workers & Pages**, créez un Worker séparé nommé `galeries-remiproduction` (ne remplacez pas les Workers `siteweb` ou `oauth-proxy`). Collez `cloudflare/galerie-router.js`, puis ajoutez :

- Variable : `PAGES_ORIGIN` = `siteweb-3vb.pages.dev`.
- Binding D1 : variable `DB` reliée à `galeries-remiproduction`.
- Cron Trigger : `0 3 * * *` (purge quotidienne des e-mails de plus de 12 mois).

Publiez le Worker.

## 4. Ajouter les routes et le DNS

Avant le wildcard, examinez les enregistrements et Workers existants. Gardez les DNS spécifiques déjà présents. Le Worker fourni laisse passer vers leur origine DNS les sous-domaines réservés et ceux sans galerie publiée. Ajoutez le CNAME wildcard `*` vers `siteweb-3vb.pages.dev` avec le nuage orange activé. Associez le Worker à ces deux routes :

- `remiproduction.fr/api/*`
- `*.remiproduction.fr/*`

## 5. Ajouter les photos et livrer

Dans `https://remiproduction.fr/admin` > **Galeries clients**, créez la galerie. Cliquez sur **Ajouter une photo**, puis glissez le fichier sur le champ Image. Répétez pour chaque photo et publiez.

Le client peut télécharger une image avec son bouton individuel ou toutes les images dans un ZIP. Avant le téléchargement, il saisit son adresse e-mail. Elle est conservée dans D1 avec le slug de la galerie, n’est pas utilisée pour du marketing et est supprimée après 12 mois sans téléchargement. Pour lister les adresses, utilisez la requête SQL dans `cloudflare/README.md`.

Les fichiers doivent être envoyés dans la médiathèque du site (`images/`) pour être inclus dans le ZIP. Les galeries ne sont pas verrouillées par mot de passe : toute personne qui possède le lien peut voir les photos.
