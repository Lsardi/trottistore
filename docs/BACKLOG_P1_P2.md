# Backlog Produit — P1/P2

Features identifiées comme non-implémentées ou partielles. Priorisées par impact business.

## P1 — Important (post-lancement, semaine 2-3)

### Newsletter réelle
**Constat :** Le formulaire newsletter en homepage capture l'email mais ne fait rien.
**Action :**
- Créer model `NewsletterSubscriber` (email, status, subscribedAt, unsubscribedAt)
- Route `POST /newsletter/subscribe` (double opt-in email)
- Route `GET /newsletter/unsubscribe?token=...`
- Brancher sur les campagnes CRM (segment "newsletter")
- Formulaire footer → appel API réel
**Effort :** ~4h

### Compatibilité réelle (base scooters dynamique)
**Constat :** La liste de marques/modèles est hardcodée dans `scooter-brands.ts`. La recherche produits est réelle.
**Action :**
- Enrichir la base depuis les tickets SAV (modèles réparés = modèles réels)
- Route `GET /scooter-models` agrège les `productModel` uniques des RepairTickets
- Frontend charge la liste depuis l'API au lieu du fichier statique
- Fallback sur la liste statique si API vide
**Effort :** ~3h

### Garage synchronisé serveur
**Constat :** Le garage client (trottinettes possédées) est stocké en localStorage uniquement. Perdu si l'utilisateur change de navigateur.
**Action :**
- Le model `CustomerProfile.scooterModels` existe déjà (String[])
- Route `PUT /auth/garage` (sync les modèles)
- Frontend : sync localStorage ↔ API quand l'utilisateur est connecté
- Merge les deux sources au login
**Effort :** ~3h

## P2 — Nice-to-have (mois 2+)

### Email commande expédiée
**Constat :** L'email de confirmation commande existe. Mais quand la commande passe en SHIPPED, pas d'email au client avec le numéro de suivi.
**Action :**
- Template `orderShippedEmail(name, orderNumber, trackingNumber, carrier)`
- Envoyer automatiquement quand admin change status → SHIPPED
**Effort :** ~2h

### Panier abandonné
**Constat :** Les paniers Redis expirent silencieusement. Pas de relance email.
**Action :**
- Cron qui identifie les paniers > 24h avec un userId associé
- Email de relance avec lien vers le panier
- Tracking analytics (taux de récupération)
**Effort :** ~4h

### Avis post-achat automatique
**Constat :** Le trigger `POST_REPAIR_REVIEW` existe pour les réparations. Pas d'équivalent pour les achats.
**Action :**
- Trigger automatique 7 jours après DELIVERED → email "donnez votre avis"
- Lien direct vers `/avis` avec productId pré-rempli
**Effort :** ~2h

### Multi-langue
**Constat :** Tout est en français. Le white-label supporte le branding mais pas la langue.
**Action :** i18n avec next-intl, extraction des chaînes.
**Effort :** ~2 semaines (non prioritaire)
