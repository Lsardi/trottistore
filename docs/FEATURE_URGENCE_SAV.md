# Feature: Funnel Urgence SAV (MVP)

## Objectif
Passer d'un simple formulaire SAV à un parcours de conversion complet:
- capture urgence (`/urgence`)
- ticket SAV invité
- créneaux atelier visibles
- prise de rendez-vous en ligne
- suivi réparation public en temps réel via lien tokenisé

## Backend (SAV)

### Endpoints ajoutés
- `GET /api/v1/repairs/tracking/:token`
  - suivi public d'un ticket (timeline, coût estimé, prochain RDV)
- `GET /api/v1/appointments/slots?date=YYYY-MM-DD&durationMin=60`
  - retourne les créneaux disponibles de la journée
- `POST /api/v1/appointments`
  - réserve un créneau atelier
- `PUT /api/v1/repairs/:id/quote/accept-client`
  - acceptation devis par client connecté ou invité (token de tracking)

### Endpoints existants adaptés
- `POST /api/v1/repairs`
  - accepte désormais:
    - client connecté (`customerId`)
    - ou client invité (`customerName`, `customerPhone`, `customerEmail?`)
  - génère un `trackingToken` et retourne `trackingUrl`

### Auth
Routes publiques autorisées:
- intake SAV
- suivi tokenisé
- slots RDV
- booking RDV
- acceptation devis côté client

## Frontend

### Pages ajoutées
- `/urgence` (landing + formulaire + réservation de créneau)
- `/atelier`
- `/avis`
- `/pro`
- `/guide/[slug]`
- `/reparation/[slug]` (landing SEO marque/panne)
- `/mon-compte/suivi/[token]` (timeline de suivi SAV)

### Pages adaptées
- `/reparation`
  - support client invité + affichage lien de suivi
- `/diagnostic`
  - CTA vers `/urgence` (continuum diagnostic -> action)
- `/mon-compte`
  - lien direct vers suivi SAV tokenisé

### Composants globaux
- `SOSButton` sticky mobile (appel/diagnostic/ticket/itinéraire)
- `StructuredData` (LocalBusiness + FAQ)

## Database (Prisma)

### `sav.RepairTicket`
Ajouts:
- `customerName`, `customerEmail`, `customerPhone`
- `trackingToken` (unique)
- `quoteAcceptedAt`
- relation `appointments`

Modification:
- `customerId` devient nullable (support invité)

### Nouveau modèle `sav.RepairAppointment`
- gestion des RDV atelier (start/end, express, statut, contact, lien ticket)

## Mise en prod
1. Appliquer le schéma:
   - `pnpm --filter @trottistore/database db:push`
2. Regénérer Prisma:
   - `pnpm --filter @trottistore/database db:generate`
3. Déployer web + service SAV.

## Notes de scalabilité
- Slots calculés côté backend avec détection d'overlap.
- Tracking public via token UUID (pas d'ID séquentiel exposé).
- Le flux SMS/WhatsApp est prêt à être ajouté via webhook sur changement de statut.
