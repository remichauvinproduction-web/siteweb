# remiproduction.fr

Site statique (HTML / CSS / JavaScript) hébergé sur GitHub et Cloudflare Pages. Les galeries utilisent aussi Cloudflare Workers, D1 et R2.

## Organisation des fichiers

```
index.html · realisations.html · services.html · a-propos.html · contact.html
mentions-legales.html · 404.html        → une page = un fichier, textes écrits directement dedans
assets/css/style.css                    → tout le design (palette, typographie, composants)
assets/js/main.js                       → menu, portfolio, lecteur vidéo, bande démo, formulaire
assets/fonts/                           → polices auto-hébergées (aucune requête vers Google)
data/videos.json · gallery.json         → réalisations vidéo et galerie photo
data/galeries/*.json                     → métadonnées des galeries (une galerie = un fichier)
cloudflare/                              → Worker routeur, API, migrations D1 et configuration R2
data/showreel.json                      → bande démo de l'accueil
images/                                 → images optimisées (WebP) + logo + image de partage
admin/                                  → admin maison (/admin) et outils locaux (/admin/outils.html)
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

Dans `/admin`, connectez-vous avec GitHub puis ouvrez **Galeries clients**. Déposez les JPEG/PNG/WebP/AVIF et principaux RAW (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF) en lot. Les originaux partent dans R2; un aperçu WebP est créé dans le navigateur. Les RAW sont conservés tels quels et leur aperçu web est dérivé du JPEG intégré au fichier. Les albums sont listés dans `data/galeries/`. Le slug fournit les liens `https://slug.remiproduction.fr/` et `https://remiproduction.fr/galerie/slug`.

La galerie client s’adapte aux écrans, permet de marquer des favoris et d’envoyer la sélection sans compte. Les téléchargements gratuits peuvent être désactivés; lorsqu’ils sont activés, on peut proposer l’original ou la version web. L’admin affiche vues, favoris, téléchargements et sélections. Une boutique numérique optionnelle vend la galerie complète ou la sélection favorite via Stripe Checkout et ne remet les fichiers qu’après vérification du paiement par le Worker. Elle exige un secret Stripe configuré dans Cloudflare. Les outils gratuits se trouvent dans `/admin/outils.html` : filigrane et export par lot, calculateur tarifaire et modèles imprimables en PDF. Le traitement des images dans ces outils s’effectue dans le navigateur.

L’administration maison permet aussi de modifier les réalisations vidéo, les photos du portfolio et la bande démo. Les textes des pages et les tarifs du site restent modifiables dans leurs fichiers HTML. La configuration Cloudflare, D1, R2 et Stripe est décrite dans [`cloudflare/README.md`](cloudflare/README.md).

Les galeries sont accessibles par leur URL et ne sont pas protégées par mot de passe. Pour activer les sous-domaines, suivre [`cloudflare/README.md`](cloudflare/README.md) : la configuration ajoute un DNS wildcard et un Worker Route qui relaie les requêtes au site Pages.

## Formulaire de contact

Il envoie le message à `remichauvinproduction@gmail.com` via FormSubmit (gratuit, sans compte). **Au premier envoi après la mise en ligne**, FormSubmit envoie un e-mail d'activation à cette adresse : cliquer sur le lien, sinon aucun message n'est livré. À tester une fois sur le site en ligne.

## Police Matcha Mint

Non fournie dans le dépôt (licence web à vérifier). Pour l'activer : déposer `matcha-mint.woff2` dans `assets/fonts/` puis décommenter le bloc `@font-face "Matcha Mint"` en haut de `assets/css/style.css`. Elle remplace automatiquement la police d'écriture du logo.

## URLs

Les liens internes sont sans extension (`/services`, `/contact`…), ce que fait nativement Cloudflare Pages, GitHub Pages et Netlify.
