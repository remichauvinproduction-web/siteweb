# Configuration Cloudflare des galeries

Le site Pages `siteweb` sert les pages. Le Worker `galeries-remiproduction` fournit les adresses `slug.remiproduction.fr`, conserve événements, sélections et commandes dans D1, et dépose les originaux et aperçus dans R2. Le paiement Stripe est optionnel et reste désactivé tant que le secret Stripe n’est pas configuré.

## 1. Déployer les fichiers du site

Publier les fichiers du paquet dans le dépôt GitHub et déployer le site Pages depuis la branche de production. Le nom Pages visible dans Cloudflare est `siteweb-3vb.pages.dev`.

## 2. Créer la base D1 et appliquer les migrations

Dans Cloudflare, ouvrir **Storage & databases > D1 SQL Database > Create** et créer `galeries-remiproduction`. Dans sa console SQL, exécuter dans l’ordre `migrations/0001_gallery_download_emails.sql`, puis `migrations/0002_gallery_insights.sql`. Conserver l’ID affiché par Cloudflare. La deuxième migration crée les événements, sélections clients et commandes payantes.

## 3. Créer le stockage photo R2

Dans **Storage & databases > R2 Object Storage**, créer le bucket `galeries-remiproduction-media`. Dans les paramètres du Worker, ajouter un binding R2 nommé exactement `GALLERY_MEDIA` vers ce bucket. Les fichiers sont servis par le Worker depuis `/api/media/…`; ne rendez pas le bucket public directement. Les aperçus WebP sont produits dans le navigateur. Pour les RAW pris en charge, l’outil extrait l’aperçu JPEG intégré et crée sa version WebP; le fichier RAW original est gardé dans R2.

## 4. Publier le Worker

1. Dans **Workers & Pages**, créer un Worker `galeries-remiproduction` et remplacer son code par `galerie-router.js`.
2. Dans **Settings > Bindings > Add binding > D1 database**, créer le binding nommé `DB` et le relier à la base `galeries-remiproduction`.
3. Dans **Settings > Triggers > Cron Triggers**, ajouter `0 3 * * *` pour purger les anciennes adresses chaque jour.
4. Publier le Worker.

Le fichier `wrangler.toml` contient aussi les réglages équivalents pour un déploiement Wrangler. Pour cette méthode, remplacer `REMPLACER_PAR_ID_D1` par l’ID D1 réel avant le déploiement.

## 5. DNS et routes

Dans **Cloudflare > remiproduction.fr > DNS > Records**, ajouter le CNAME wildcard ci-dessous. Garder tous les enregistrements plus précis déjà présents.

| Type | Nom | Cible | Proxy |
|---|---|---|---|
| CNAME | `*` | `siteweb-3vb.pages.dev` | Activé (nuage orange) |

Avant d’ajouter les routes, vérifier l’onglet DNS et les sous-domaines existants. La route wildcard intercepte les requêtes HTTP(S) des sous-domaines proxifiés. Le Worker fourni transmet les hôtes réservés et les noms sans galerie publiée à leur origine DNS (`fetch(request)`) ; les autres services HTTP doivent donc avoir un enregistrement DNS proxifié et leur origine doit répondre correctement. Dans **Settings > Domains & Routes > Add > Route**, associer le Worker à ces deux routes :

- `remiproduction.fr/api/*` — journal des téléchargements depuis le domaine principal.
- `*.remiproduction.fr/*` — pages galeries et appels API depuis les sous-domaines.

Vérifier que le certificat Cloudflare couvre `*.remiproduction.fr`. Les sous-domaines réservés `www`, `admin`, `mail`, `smtp`, `imap`, `ftp`, `autodiscover` et `oauth-proxy` ne sont pas transformés en galerie.

Une galerie dont le slug est `mariage-lea-et-noe` sera alors accessible via `https://mariage-lea-et-noe.remiproduction.fr/` et `https://remiproduction.fr/galerie/mariage-lea-et-noe`.

## 6. Paiements Stripe (facultatif)

Pour encaisser directement sur le compte Stripe du photographe, créer/configurer son compte Stripe, puis ajouter `STRIPE_SECRET_KEY` comme **Secret** du Worker `galeries-remiproduction` (une clé de production `sk_live_…` pour encaisser en réel; `sk_test_…` pour les essais). Ne jamais mettre cette clé dans GitHub ou dans les fichiers du site. Dans l’admin, cocher la boutique et fixer le prix d’une galerie numérique complète. Le checkout Stripe hébergé collecte le paiement; les originaux R2 ne sont délivrés qu’après vérification de la session payée côté Worker. Le Worker doit avoir les bindings `DB` et `GALLERY_MEDIA`.

La boutique vend en paiement unique soit tous les originaux de la galerie, soit les photos que le client a mises en favoris. Le prix est fixé par galerie; en mode sélection, le prix est appliqué à chaque photo choisie. Les tirages papier, options de retouche par photo, remboursements automatiques et facturation Stripe ne sont pas configurés par ce code.

## 7. Données et statistiques

Pour les téléchargements gratuits, le client peut saisir son adresse e-mail; le Worker l’associe au slug. La sélection envoyée en galerie peut aussi contenir un e-mail facultatif. Les vues, favoris, téléchargements et sélections sont visibles dans **Statistiques** de l’admin. Le Worker ne conserve pas l’adresse IP. Le nettoyage automatique efface les e-mails, sélections et références de commande après 12 mois; les événements d’audience après 24 mois. Stripe conserve séparément les données nécessaires à ses paiements.

Les clients peuvent exercer leurs droits via `remichauvinproduction@gmail.com`. Le détail est indiqué dans `mentions-legales.html`. Toute personne disposant du lien peut voir les aperçus. Le réglage « téléchargements gratuits » désactive l’accès Worker aux originaux et masque les boutons de téléchargement; les aperçus restent consultables.

Pour consulter les adresses dans la console D1, exécuter :

```sql
SELECT email, gallery_slug, first_download_at, last_download_at
FROM gallery_download_emails
ORDER BY last_download_at DESC;
```

## Retour arrière

Retirer les deux routes Worker et le CNAME `*` pour désactiver les sous-domaines et l’enregistrement des téléchargements. Les galeries sous `/galerie/slug` restent visibles, mais les téléchargements nécessitant l’adresse e-mail ne fonctionneront plus tant que la route API n’est pas rétablie.
