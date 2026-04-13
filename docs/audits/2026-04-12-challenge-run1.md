# Challenge Audit Run 1 — 2026-04-12

## Règles
- Claude et Codex auditent en parallèle, 1 run chacun
- Objectif : trouver le maximum de vrais bugs avant que Lyes les trouve
- Pas de théorie, que du réel avec file:line

## Résultats

**17 bugs uniques, 0 overlap entre les 2 agents.**

---

### CRASH / CRITIQUE (2)

| ID | Source | Bug | Fichier:Ligne | Impact |
|---|---|---|---|---|
| C1 | Claude | Guest bcrypt crash — passwordHash invalide (pas format bcrypt), bcrypt.compare() throw | orders/index.ts:908 + auth/index.ts:254 | Auth 500 si guest tente login direct |
| C2 | Codex | TVA hardcodée 20% — ignore tvaRate par produit. Totaux commande/checkout calculés en dur. | orders/index.ts:470,481,835,842,2039,2045 + checkout/index.ts:237 + schema.prisma:229 | Factures fausses, comptabilité corrompue |

### WRONG_DATA / MAJEUR (4)

| ID | Source | Bug | Fichier:Ligne | Impact |
|---|---|---|---|---|
| M1 | Claude | Refund sur commande PENDING (pas de validation state machine dans le flow refund) | orders/index.ts:1827 | Ordre PENDING→REFUNDED (transition interdite) |
| M2 | Codex | Refund non borné au montant commande (amount > totalTtc envoyé à Stripe) | orders/index.ts:1757,1759,1804 | 502 évitable, comportement non déterministe |
| M3 | Codex | Facture PDF affiche TVA du 1er item uniquement (order.items[0]?.tvaRate) | admin-invoices/index.ts:123 | Mention TVA fausse pour commandes multi-taux |
| M4 | Claude | Invoice number gaps si ordre supprimé et re-facturé (autoincrement) | admin-invoices/index.ts:56 | Non conforme CGI art. 289 |

### BROKEN / MOYEN (5)

| ID | Source | Bug | Fichier:Ligne | Impact |
|---|---|---|---|---|
| B1 | Claude | /admin/equipe pas dans le sidebar (page orpheline) | layout.tsx:23-34 | Page inaccessible via navigation |
| B2 | Claude | /admin/parametres pas dans le sidebar (page orpheline) | layout.tsx:23-34 | Page inaccessible via navigation |
| B3 | Claude | Pas de settingsApi dans lib/api.ts (raw fetch dans parametres) | parametres/page.tsx:30,59 | Pas de gestion d'erreur centralisée |
| B4 | Claude | Pas de adminUsersApi dans lib/api.ts (raw fetch dans equipe) | equipe/page.tsx:61,78,107,122 | Idem |
| B5 | Codex | Settings admin pas reflétées dans mentions légales + factures (phone/email restent env vars) | parametres/page.tsx:124 + mentions-legales/page.tsx:57,82 + admin-invoices/index.ts:15 | Données admin sauvegardées mais pas utilisées |

### UX / MINEUR (6)

| ID | Source | Bug | Fichier:Ligne | Impact |
|---|---|---|---|---|
| U1 | Claude | Checkout silent auth downgrade → guest sans avertissement | checkout/page.tsx:133-154 | Utilisateur perd ses infos silencieusement |
| U2 | Claude | SIRET sans validation format (accepte n'importe quoi) | parametres/page.tsx:132 | Données légales invalides acceptées |
| U3 | Claude | SUPERADMIN dans labels/colors mais pas dans le select de création | equipe/page.tsx:177-182 | Incohérence UI |
| U4 | Claude | Homepage ISR 120s → produit archivé visible 2 min | page.tsx:55 | UX confuse, 404 au clic |
| U5 | Claude | Checkout pas de validation cart vide côté frontend dans handler submit | checkout/page.tsx:255 | Race condition possible |
| U6 | Codex | RCS annoncé dans commentaire facture mais jamais affiché dans legalFooter() | admin-invoices/index.ts:9,23 | Mentions légales PDF incomplètes |

---

## Stats

| Agent | Bugs trouvés | CRASH | MAJEUR | MOYEN | MINEUR |
|---|---|---|---|---|---|
| Claude | 12 | 1 | 2 | 4 | 5 |
| Codex | 5 | 1 | 2 | 1 | 1 |
| **Total** | **17** | **2** | **4** | **5** | **6** |

## Status
**Non corrigés — en attente du Run 2.**
