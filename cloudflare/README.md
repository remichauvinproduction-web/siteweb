# Sous-domaines automatiques pour les galeries

Cette configuration ajoute `slug.remiproduction.fr` en complément du lien `/galerie/slug`. Cloudflare Pages ne prend pas en charge les domaines personnalisés wildcard directement ; le Worker ci-joint relaie les requêtes vers le site Pages et transforme la racine du sous-domaine en page de galerie.

## Avant de commencer

1. Vérifier que `remiproduction.fr` est une zone active dans le compte Cloudflare du site.
2. Ouvrir **Workers & Pages** et relever le nom du domaine `*.pages.dev` déjà attribué au projet Pages.
3. Examiner les enregistrements DNS et les Workers déjà utilisés sur les sous-domaines. La route wildcard intercepte les sous-domaines proxifiés qui ne sont couverts par aucune route plus précise. Ne pas l'activer avant d'avoir confirmé que cela ne détournera pas un service existant.
4. Téléverser dans GitHub et déployer les fichiers du site depuis la branche souhaitée. Si Pages est déjà relié à GitHub, son déploiement automatique publie ces changements.

## DNS

Dans **Cloudflare > remiproduction.fr > DNS > Records**, ajouter :

| Type | Nom | Cible | Proxy |
|---|---|---|---|
| CNAME | `*` | `<NOM-DU-PROJET>.pages.dev` | Activé (nuage orange) |

Le wildcard DNS ne remplace pas les enregistrements existants plus précis. Conserver les lignes `www`, mail et autres services déjà configurés. Les enregistrements wildcard doivent être proxifiés pour que le Worker Route soit appelé.

## Worker depuis le tableau de bord

1. Dans **Workers & Pages**, créer un Worker nommé `galeries-remiproduction`.
2. Copier le contenu de `cloudflare/galerie-router.js` dans son éditeur, puis déployer.
3. Dans **Settings > Variables and Secrets**, ajouter la variable texte `PAGES_ORIGIN` avec la valeur réelle, par exemple `remiproduction.pages.dev` (sans `https://` ni slash), puis redéployer.
4. Dans **Settings > Domains & Routes > Add > Route**, ajouter `*.remiproduction.fr/*` sur la zone `remiproduction.fr`.
5. Vérifier dans **SSL/TLS** que le certificat universel couvre `*.remiproduction.fr` et que le mode SSL est `Full` ou `Full (strict)`.

Les noms de galeries deviennent alors leurs sous-domaines : une galerie au slug `mariage-lea-et-noe` répond sur `https://mariage-lea-et-noe.remiproduction.fr/`. Le slug est automatiquement tiré du nom de la galerie dans Decap CMS. Les sous-domaines réservés `www`, `admin`, `mail`, `smtp`, `imap`, `ftp`, `autodiscover` et `oauth-proxy` ne sont pas transformés en galerie.

## Retour arrière

Pour désactiver les sous-domaines, retirer la route `*.remiproduction.fr/*` et le CNAME `*`. Les liens `https://remiproduction.fr/galerie/slug` restent disponibles.

## Limites

Les galeries utilisent des URL difficiles à deviner, mais aucun mot de passe ni contrôle d'accès n'est mis en place. Toute personne ayant le lien peut voir et télécharger les images. Le proxy Worker ajoute une requête Worker pour chaque ressource chargée sur le sous-domaine (page, scripts, styles, données, images).
