# Mise en ligne de l’administration et des galeries

## 1. Publier les fichiers du site

Publier les changements de ce dossier sur la branche de production GitHub (`main`). Cloudflare Pages doit redéployer le projet `siteweb`. L’admin personnalisée est accessible sur `https://remiproduction.fr/admin/`; les utilitaires sont sur `/admin/outils.html`.

Dans l’admin, la connexion GitHub utilise le Worker OAuth déjà configuré et le compte doit pouvoir écrire dans `remichauvinproduction-web/siteweb`.

## 2. Créer et lier D1

Dans Cloudflare, créer (ou réutiliser) la base D1 `galeries-remiproduction`. Exécuter dans l’ordre les fichiers :

1. `cloudflare/migrations/0001_gallery_download_emails.sql`
2. `cloudflare/migrations/0002_gallery_insights.sql`

La deuxième migration ajoute les statistiques, les sélections client et les commandes boutique.

## 3. Créer et lier R2

Dans **R2 Object Storage**, créer le bucket `galeries-remiproduction-media`. Dans **Workers & Pages > galeries-remiproduction > Settings > Bindings**, ajouter un binding R2 avec le nom exact `GALLERY_MEDIA` et choisir ce bucket. Ne pas rendre le bucket public : les fichiers passent par le Worker.

## 4. Mettre à jour le Worker galerie

Dans le Worker existant `galeries-remiproduction`, remplacer le code par `cloudflare/galerie-router.js`, puis vérifier les bindings :

- D1 `DB` → `galeries-remiproduction`;
- R2 `GALLERY_MEDIA` → `galeries-remiproduction-media`.
- Variable `PAGES_ORIGIN` = `siteweb-3vb.pages.dev`.
- Cron Trigger = `0 3 * * *`.

Garder les routes `remiproduction.fr/api/*` et `*.remiproduction.fr/*`, et le DNS wildcard existant. Ne pas modifier `siteweb` ou `oauth-proxy`.

## 5. Activer Stripe (facultatif)

Pour les ventes, dans les variables du Worker, ajouter `STRIPE_SECRET_KEY` comme **Secret**, jamais comme variable publique ou fichier Git. Une clé de test (`sk_test_…`) permet de vérifier le paiement en mode test; la clé réelle (`sk_live_…`) encaisse sur le compte Stripe correspondant. Dans l’admin, activer **Vendre la galerie numérique complète** et choisir son prix. Une galerie en vente doit avoir ses originaux dans R2 et les téléchargements gratuits désactivés automatiquement.

Les ventes couvrent soit toute la galerie, soit la sélection favorite en un paiement. En mode sélection, le tarif défini dans l’admin s’applique à chaque photo choisie. Les tirages papier, options de retouche, abonnements et émission de facture Stripe ne sont pas configurés.

## 6. Créer une galerie et vérifier

Dans `/admin`, créer une galerie, déposer toutes les photos à la fois puis enregistrer. Pour les RAW, le navigateur extrait l’aperçu JPEG intégré et en fabrique une version web; l’original reste disponible pour la livraison haute définition. Certains RAW sans aperçu JPEG exploitable seront refusés.

La mise à jour du JSON GitHub déclenche Cloudflare Pages; attendre la fin du déploiement avant de communiquer le lien. Tester l’URL `https://slug.remiproduction.fr/`, le bouton de favoris, l’envoi d’une sélection, les statistiques, puis les téléchargements. Tester les paiements avec Stripe en mode test avant d’activer une clé réelle.

Les outils dans `/admin/outils.html` traitent les fichiers localement. Pour exporter un document en PDF, utiliser l’aperçu d’impression puis choisir **Enregistrer au format PDF**.
