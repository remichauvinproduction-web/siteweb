# Configuration Cloudflare des galeries

Le site Pages `siteweb` sert les fichiers photo et les pages. Le Worker `galeries-remiproduction` fournit les adresses `slug.remiproduction.fr`, enregistre les adresses e-mail données au téléchargement dans D1 et efface chaque jour les entrées âgées de plus de 12 mois. Le code et la configuration de départ sont dans ce dossier.

## 1. Déployer les fichiers du site

Publier les fichiers du paquet dans le dépôt GitHub et déployer le site Pages depuis la branche de production. Le nom Pages visible dans Cloudflare est `siteweb-3vb.pages.dev`.

## 2. Créer la base D1

Dans Cloudflare, ouvrir **Storage & databases > D1 SQL Database > Create** et créer `galeries-remiproduction`. Dans sa console SQL, exécuter le contenu de `migrations/0001_gallery_download_emails.sql`. Conserver l’ID affiché par Cloudflare.

## 3. Publier le Worker

1. Dans **Workers & Pages**, créer un Worker `galeries-remiproduction` et remplacer son code par `galerie-router.js`.
2. Dans **Settings > Bindings > Add binding > D1 database**, créer le binding nommé `DB` et le relier à la base `galeries-remiproduction`.
3. Dans **Settings > Triggers > Cron Triggers**, ajouter `0 3 * * *` pour purger les anciennes adresses chaque jour.
4. Publier le Worker.

Le fichier `wrangler.toml` contient aussi les réglages équivalents pour un déploiement Wrangler. Pour cette méthode, remplacer `REMPLACER_PAR_ID_D1` par l’ID D1 réel avant le déploiement.

## 4. DNS et routes

Dans **Cloudflare > remiproduction.fr > DNS > Records**, ajouter le CNAME wildcard ci-dessous. Garder tous les enregistrements plus précis déjà présents.

| Type | Nom | Cible | Proxy |
|---|---|---|---|
| CNAME | `*` | `siteweb-3vb.pages.dev` | Activé (nuage orange) |

Avant d’ajouter les routes, vérifier l’onglet DNS et les sous-domaines existants. La route wildcard intercepte les requêtes HTTP(S) des sous-domaines proxifiés. Le Worker fourni transmet les hôtes réservés et les noms sans galerie publiée à leur origine DNS (`fetch(request)`) ; les autres services HTTP doivent donc avoir un enregistrement DNS proxifié et leur origine doit répondre correctement. Dans **Settings > Domains & Routes > Add > Route**, associer le Worker à ces deux routes :

- `remiproduction.fr/api/*` — journal des téléchargements depuis le domaine principal.
- `*.remiproduction.fr/*` — pages galeries et appels API depuis les sous-domaines.

Vérifier que le certificat Cloudflare couvre `*.remiproduction.fr`. Les sous-domaines réservés `www`, `admin`, `mail`, `smtp`, `imap`, `ftp`, `autodiscover` et `oauth-proxy` ne sont pas transformés en galerie.

Une galerie dont le slug est `mariage-lea-et-noe` sera alors accessible via `https://mariage-lea-et-noe.remiproduction.fr/` et `https://remiproduction.fr/galerie/mariage-lea-et-noe`.

## 5. Données e-mail

Avant chaque téléchargement à l’unité ou du ZIP, le client saisit son adresse e-mail. Le Worker associe l’adresse au slug de la galerie et met à jour la date du dernier téléchargement. Il ne conserve ni adresse IP ni données de paiement et n’envoie pas de messages marketing. Le nettoyage automatique quotidien efface les adresses après 12 mois sans nouveau téléchargement.

Les clients peuvent exercer leurs droits via `remichauvinproduction@gmail.com`. Le détail est indiqué dans `mentions-legales.html`. Toute personne disposant du lien d’une galerie peut voir et télécharger les photos ; l’adresse e-mail est demandée pour le registre des téléchargements, ce n’est pas un contrôle d’accès.

Pour consulter les adresses dans la console D1, exécuter :

```sql
SELECT email, gallery_slug, first_download_at, last_download_at
FROM gallery_download_emails
ORDER BY last_download_at DESC;
```

## Retour arrière

Retirer les deux routes Worker et le CNAME `*` pour désactiver les sous-domaines et l’enregistrement des téléchargements. Les galeries sous `/galerie/slug` restent visibles, mais les téléchargements nécessitant l’adresse e-mail ne fonctionneront plus tant que la route API n’est pas rétablie.
