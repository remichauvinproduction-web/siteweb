# remiproduction.fr

Site statique (HTML / CSS / JavaScript, sans framework ni base de données), hébergé sur GitHub + hébergement statique (Cloudflare Pages).

## Organisation des fichiers

```
index.html · realisations.html · services.html · a-propos.html · contact.html
mentions-legales.html · 404.html        → une page = un fichier, textes écrits directement dedans
assets/css/style.css                    → tout le design (palette, typographie, composants)
assets/js/main.js                       → menu, portfolio, lecteur vidéo, bande démo, formulaire
assets/fonts/                           → polices auto-hébergées (aucune requête vers Google)
data/videos.json · gallery.json         → réalisations vidéo et galerie photo
data/galeries/*.json                     → galeries de livraison client (une galerie = un fichier)
cloudflare/                              → Worker routeur pour les sous-domaines de galerie
data/showreel.json                      → bande démo de l'accueil
images/                                 → images optimisées (WebP) + logo + image de partage
admin/                                  → interface Decap CMS (/admin) pour le portfolio
sitemap.xml · robots.txt · _headers     → SEO et cache
```

## Modifier le contenu

| Quoi | Où |
|---|---|
| Ajouter / modifier une vidéo | `/admin` › Réalisations vidéo (ou `data/videos.json`) |
| Ajouter / modifier une photo | `/admin` › Galerie photo (ou `data/gallery.json`) |
| Créer / modifier une galerie client | `/admin` › Galeries clients |
| Activer la bande démo | `/admin` › Bande démo : renseigner le lien YouTube (ou `data/showreel.json`) |
| Tarifs | `services.html`, bloc entouré de « MODIFIER LES TARIFS ICI » |
| Textes des pages | directement dans le fichier `.html` concerné |
| Témoignages | modèle commenté dans `index.html` (« TÉMOIGNAGES »), à activer avec un accord écrit du client |

Format d'une vidéo : `orientation` = `16:9` ou `9:16`, `category` = `publicite`, `entreprise`, `reseaux`, `evenementiel` ou `creation`. Seules les catégories qui contiennent un projet apparaissent dans les filtres. Les champs `client` et `role` vides ne sont pas affichés.

## Galeries de livraison client

Dans `/admin` › **Galeries clients**, créez un album et ajoutez ses photos. Le nom de la galerie sert à créer un fichier JSON dans `data/galeries/` ; son slug devient automatiquement le lien partageable `https://slug.remiproduction.fr/` et le lien alternatif `https://remiproduction.fr/galerie/slug`. La page propose l’agrandissement des images, les favoris enregistrés dans le navigateur du visiteur, le téléchargement des photos et la copie du lien. Les photos ajoutées dans l’administration sont stockées dans `images/` ; un fichier HD distinct peut être indiqué pour chaque photo.

Les galeries sont accessibles par leur URL et ne sont pas protégées par mot de passe. Pour activer les sous-domaines, suivre [`cloudflare/README.md`](cloudflare/README.md) : la configuration ajoute un DNS wildcard et un Worker Route qui relaie les requêtes au site Pages.

## Formulaire de contact

Il envoie le message à `remichauvinproduction@gmail.com` via FormSubmit (gratuit, sans compte). **Au premier envoi après la mise en ligne**, FormSubmit envoie un e-mail d'activation à cette adresse : cliquer sur le lien, sinon aucun message n'est livré. À tester une fois sur le site en ligne.

## Police Matcha Mint

Non fournie dans le dépôt (licence web à vérifier). Pour l'activer : déposer `matcha-mint.woff2` dans `assets/fonts/` puis décommenter le bloc `@font-face "Matcha Mint"` en haut de `assets/css/style.css`. Elle remplace automatiquement la police d'écriture du logo.

## URLs

Les liens internes sont sans extension (`/services`, `/contact`…), ce que fait nativement Cloudflare Pages, GitHub Pages et Netlify.
