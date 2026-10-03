# Codex — Magasin V1 : écrans front (caisse, aujourd'hui, réception/inventaire)

**Contexte** : l'app est l'outil quotidien d'une boutique-atelier (voir README « une journée au magasin » et `AUDIT_2026-10-03.md` §0). Le backend des trois manques bloquants est livré et testé (PR `claude/magasin-v1-backend`, empilée sur `codex/front`). Il reste les écrans `apps/web` — périmètre Codex.

**Règles** : Tailwind + composants existants (`/admin` utilise déjà `admin/layout.tsx`), pas de refonte visuelle, mobile-first pour la caisse et le technicien (tablette/téléphone à l'établi), aucune donnée personnelle dans Sentry/logs. `apiFetch` dans `apps/web/src/lib/api.ts` ; ajouter les clients `posApi`, `todayApi`, `purchaseOrdersApi.receive`, `stockApi.inventory`.

Toutes les routes ci-dessous exigent un JWT staff (`SUPERADMIN|ADMIN|MANAGER|STAFF`, `TECHNICIAN` seulement sur `/today` SAV). Réponses `{ success, data }` / `{ success: false, error: { code, message } }`.

---

## 1. `/admin/caisse` — vente comptoir

**Service ecommerce**

| Méthode | Route | Corps / query | Retour |
|---|---|---|---|
| GET | `/admin/pos/session` | — | `data: null` ou `{ id, status: "OPEN", openedAt, openingCashCents, salesCount, totalsByMethod: { CASH?: number, CARD_TERMINAL?: number, CHECK?: number } }` |
| POST | `/admin/pos/session/open` | `{ openingCashCents, note? }` | 201 session · 409 `SESSION_ALREADY_OPEN` |
| POST | `/admin/pos/session/close` | `{ closingCashCents, note? }` | `{ ...session, status: "CLOSED", expectedCashCents, closingCashCents, differenceCents }` · 409 `NO_OPEN_SESSION` / `SESSION_ALREADY_CLOSED` |
| GET | `/admin/pos/lookup?q=&limit=` | `q` = scan (EAN/SKU exact → 1 résultat, `exactMatch: true`) ou texte | `data: [{ variantId, productId, productName, variantName, sku, barcode, unitPriceHt, tvaRate, available, exactMatch }]` |
| POST | `/admin/pos/sales` | `{ items: [{ variantId, quantity, unitPriceHt?, serialNumbers? }], paymentMethod: "CASH"\|"CARD_TERMINAL"\|"CHECK", customerId?, discountHt?, cashReceivedCents?, note? }` | 201 `{ order, receipt: { orderNumber, subtotalHt, tvaAmount, totalTtc, discountHt, paymentMethod, changeCents } }` · 409 `NO_OPEN_SESSION` / `INSUFFICIENT_STOCK` · 400 `CASH_INSUFFICIENT` / `SERIAL_COUNT_MISMATCH` · 404 `VARIANT_NOT_FOUND` / `CUSTOMER_NOT_FOUND` |
| GET | `/admin/pos/sales?sessionId=` | — | ventes de la session (défaut : ouverte) |

**Écran** (une seule page, états) :
1. **Caisse fermée** → formulaire « fond de caisse » (montant en €, converti en centimes) → Ouvrir.
2. **Caisse ouverte** → trois zones : (a) champ de scan autofocus (`q`), Enter → si `exactMatch` ajoute la ligne direct, sinon liste de résultats cliquables ; (b) ticket en cours : lignes (nom, SKU, qté ±, PU HT éditable, dispo), remise ticket, totaux HT/TVA/TTC recalculés **côté client pour l'affichage uniquement** (le serveur fait foi, afficher `receipt` au retour) ; (c) paiement : 3 gros boutons CASH / CB / CHÈQUE ; en CASH, champ « reçu » → rendu affiché ; client optionnel (recherche par email/nom via `customersApi` existant). Numéros de série : champ optionnel par ligne quand quantité ≤ 5.
3. **Après vente** → écran reçu (n° commande, lignes, total, rendu) avec bouton **Imprimer** (`window.print`, CSS `@media print` ticket 80 mm) et « Nouvelle vente » (vide le ticket, refocus scan).
4. **Clôture** → bouton dans l'en-tête : saisir espèces comptées → afficher attendu / compté / écart (couleur si écart ≠ 0), total par moyen de paiement, nb de ventes → Confirmer.

Clavier : Enter = scan/ajout, `+`/`-` sur la ligne sélectionnée, `F2` paiement CASH, `F3` CB. Tablette : cibles ≥ 44 px.

---

## 2. `/admin` (accueil) — vue « aujourd'hui »

Remplacer le dashboard KPI actuel de `apps/web/src/app/(admin)/admin/page.tsx` par une **liste d'actions**, en gardant les KPI existants dans un onglet/section « Chiffres » en dessous.

| Service | Route | Retour |
|---|---|---|
| ecommerce | GET `/admin/today` | `{ generatedAt, register: { open, id?, openedAt? }, actions: { toPrepare, readyForPickup, toShip, awaitingPayment, lowStock } , today: { store: { count, totalTtc }, web: { count, totalTtc } } }` — chaque action = `{ count, items: [...≤10] }` ; items commandes = `{ id, orderNumber, status, paymentStatus, paymentMethod, shippingMethod, totalTtc, createdAt, customer: { firstName, lastName, email }, _count: { items } }` ; `lowStock.items` = `{ id, sku, name, productName, stockQuantity, lowStockThreshold }` |
| sav | GET `/today` | `{ generatedAt, scope: "all"\|"mine", appointments: { count, items: [{ id, startsAt, endsAt, customerName, customerPhone, serviceType, status, ticket? }] }, actions: { toDiagnose, inProgress, readyForPickup, quotesWithoutAnswer (+ olderThanHours: 48), waitingParts }, urgentOpen: number }` — items tickets = `{ id, ticketNumber, status, priority, type, productModel, customerName, customerPhone, assignedTo, estimatedDays, createdAt, updatedAt, estimatedCost? }` |

**Écran** : en-tête = date + état caisse (ouverte depuis… / « Ouvrir la caisse » → `/admin/caisse`) + CA du jour magasin / web. Puis cartes d'action **dans l'ordre de la journée** : RDV atelier du jour (heure, client, tel cliquable, machine) → À diagnostiquer → Commandes web à préparer → Retraits à remettre → À expédier → Réparations prêtes non récupérées (les plus anciennes en rouge) → Devis sans réponse > 48h (bouton « Appeler » = `tel:`) → En attente de pièce → Paiements attendus (virements) → Stock bas (lien vers création de bon de commande). Chaque carte : compteur, 10 premières lignes, lien « voir tout » vers la page existante filtrée. Carte vide = masquée. Pour `TECHNICIAN`, n'afficher que les cartes SAV (scope `mine`). Rafraîchissement toutes les 60 s (`setInterval` + `document.visibilityState`).

---

## 3. Réception fournisseur et inventaire

**Service ecommerce**

| Méthode | Route | Corps | Retour |
|---|---|---|---|
| POST | `/admin/purchase-orders` | existant + `items?: [{ variantId, quantityOrdered, unitCostHt? }]` | BC avec `items[].variant.{sku,name,product.name}` |
| PUT | `/admin/purchase-orders/:id/items` | `{ items: [...] }` | 409 `PO_LOCKED` si déjà réceptionné |
| POST | `/admin/purchase-orders/:id/receive` | `{ lines: [{ variantId, quantityReceived }], note? }` | `{ purchaseOrder (status PARTIAL\|RECEIVED, items[].quantityReceived), received: [{ variantId, quantity, stockAfter, overReceived }] }` · 400 `LINE_NOT_ON_PO` · 409 `PO_CLOSED` |
| POST | `/stock/inventory` | `{ counts: [{ variantId, counted }], reason? }` | 201 `{ inventoryRef, counted, adjusted, adjustments: [{ variantId, sku, before, counted, delta, belowReserved }], warnings: string[] }` · 409 `STOCK_CHANGED` (stock modifié pendant le comptage → recompter la ligne) |

**Écrans** :
- `/admin/fournisseurs` (existant) : le BC gagne des **lignes** (ajout par scan/recherche via `/admin/pos/lookup`, qté, coût HT) ; bouton **« Réceptionner »** sur un BC `SENT|PARTIAL` → page `/admin/fournisseurs/reception/[id]` : chaque ligne avec commandé / déjà reçu / **reçu aujourd'hui** (préremplie au reste), scan EAN incrémente la ligne correspondante, lignes sur-reçues en orange, Valider → résumé (stock après) ; BC `RECEIVED` grisé.
- `/admin/stock/inventaire` : choix d'un périmètre (catégorie / recherche / tout), liste des variantes avec stock système **masqué par défaut** (comptage à l'aveugle, bouton « voir ») et champ « compté » ; scan EAN = +1 sur la ligne ; Valider → résumé des écarts (delta ±, couleur), warnings `belowReserved`, `inventoryRef` ; sur `STOCK_CHANGED`, surligner la ligne et demander un recomptage. Brouillon en `localStorage` (comptage long, risque de rechargement).

---

## Tests attendus
- Unitaires Vitest (`apps/web/src/lib/*.test.ts`) pour les helpers de calcul du ticket (totaux, rendu) et le mapping scan → ligne.
- E2E Playwright : `pos.spec.ts` (ouvrir → scanner → vendre CASH → reçu → clôturer), `today.spec.ts` (manager voit toutes les cartes, tech1 seulement SAV), `reception.spec.ts` (BC → réception partielle → RECEIVED). Comptes seed : `manager@demo.fr`, `tech1@demo.fr` / `demo1234`. Le job CI E2E démarre les backends.

## Hors périmètre (V2)
Multi-caisses, tiroir-caisse/TPE connecté, avoirs/retours comptoir, impression étiquettes, planning par technicien.
