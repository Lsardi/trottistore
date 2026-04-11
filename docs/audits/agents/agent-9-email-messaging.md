# Agent 9 — Email / Messaging

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent

## Scope effectif

- `packages/shared/src/notifications/email.ts`
- `packages/shared/src/notifications/sms.ts`
- `packages/shared/src/notifications/transport.ts`
- `packages/shared/src/notifications/index.ts`
- `services/ecommerce/src/emails/templates.ts`
- `services/ecommerce/src/routes/auth/index.ts` (forgot-password, welcome, staff invite)
- `services/ecommerce/src/routes/orders/index.ts` (order confirmation, shipped)
- `services/sav/src/notifications/engine.ts`
- `services/crm/src/routes/newsletter/index.ts` (confirm, unsubscribe)
- `services/crm/src/routes/triggers/index.ts` (notification triggers)

## Findings supplémentaires

### 1. P1 — XSS dans templates email ecommerce 🔴

**Réf :** `services/ecommerce/src/emails/templates.ts:51` (`${i.name}` dans la table des items), `:60` (`${data.customerName}` dans le greeting), `:104` (passwordResetEmail), `:130` (staffInvitationEmail)

**Symptôme :** Les templates email interpolent des variables (nom produit, prénom client, lien reset) directement dans du HTML via template literals **sans échappement**. Si un produit a un nom comme `<img src=x onerror=alert()>` ou un client `firstName="<script>alert(1)</script>"`, le HTML de l'email contient le code arbitraire.

**Vecteur d'attaque :**
1. Un attaquant crée un compte avec un firstName malicieux
2. Il passe une commande (ou se fait inviter par staff)
3. Le template `orderConfirmationEmail` ou `welcomeEmail` interpole le firstName dans le HTML
4. À l'ouverture de l'email, certains clients mail (Outlook desktop, Apple Mail) exécutent le script
5. Surface limitée mais utilisable pour : phishing, vol de cookies session mail, redirection vers site malicieux

**Risque :** P1 (impact lecteur email — limité mais non-négligeable pour confidentialité/phishing). Affecte **tous les emails transactionnels ecommerce**.

**Fix proposé :**
1. Créer un helper `htmlEscape(s: string): string` qui échappe `<`, `>`, `&`, `"`, `'`
2. Appliquer à toutes les variables interpolées dans les templates HTML
3. OU mieux : utiliser un moteur de templating avec auto-escaping (Handlebars, EJS, MJML)

**Exemple de helper minimal :**
```typescript
function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Usage
const itemsHtml = data.items
  .map((i) => `<tr><td>${escape(i.name)}</td>...</tr>`)
  .join("");
```

### 2. P2 — Pas de plaintext fallback sur emails transactionnels ecommerce

**Réf :** `packages/shared/src/notifications/email.ts:24` (signature `sendEmail`)

**Symptôme :** `sendEmail()` ne supporte que HTML. Le paramètre `text` est absent. Les services SAV ont un plaintext fallback (`engine.ts:139-152`) mais pas ecommerce/auth/orders.

**Risque :** Certains clients mail / filtres anti-spam exigent un plaintext alternatif (`multipart/alternative`). Sans plaintext, le spam score augmente, taux de délivrabilité baisse.

**Fix proposé :** Étendre la signature de `sendEmail` :

```typescript
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { senderName?: string; senderEmail?: string; text?: string },
): Promise<boolean>
```

Et générer un plaintext dégradé via `html-to-text` ou un strip simple si `text` non fourni.

### 3. P2 — URLs de base / sender dispersées et incohérentes

**Réf :**
- `services/ecommerce/src/emails/templates.ts:6` → `BASE_URL`
- `services/crm/src/routes/newsletter/index.ts:25` → `PUBLIC_WEB_URL`

**Symptôme :** Deux env vars différentes pour la même chose (URL publique du site). Si seulement une est set en prod, certains emails contiennent des URLs incorrectes.

**Risque :** Liens cassés dans les emails (confirm newsletter, dashboard client, etc.).

**Fix proposé :** Centraliser dans `packages/shared/src/config.ts` :

```typescript
export const PUBLIC_WEB_URL = process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.PUBLIC_WEB_URL ||
  process.env.BASE_URL ||
  "https://trottistore.fr";
```

Importer partout au lieu de relire `process.env` à chaque fois.

### 4. P2 — Pas de logging / audit des emails ecommerce hors SAV

**Réf :** `packages/shared/src/notifications/email.ts:24-49`

**Symptôme :** `sendEmail()` est fire-and-forget sans trace persistante en DB. SAV utilise `notifyStatusChange()` qui log dans `notification_logs` + console. Auth/orders ecommerce ne persistent rien.

**Risque :** Impossible d'auditer "email perdu" lors d'un incident. "Le client n'a pas reçu sa confirmation" → on ne peut pas vérifier si on a essayé d'envoyer ni quel a été le résultat.

**Fix proposé :** Étendre la table `notification_logs` (déjà existante côté SAV) à un schema plus large. Ou créer une nouvelle table `email_audit_log` partagée :

```prisma
model EmailAuditLog {
  id           String   @id @default(uuid())
  to           String
  subject      String
  template     String   // "orderConfirmation", "shipped", "passwordReset", etc.
  status       String   // SENT, FAILED
  errorMessage String?
  serviceName  String   // "ecommerce", "crm", "sav"
  contextRef   String?  // orderId, ticketId, etc.
  sentAt       DateTime @default(now())
}
```

### 5. P3 — Newsletter confirmation email manque plaintext

**Réf :** `services/crm/src/routes/newsletter/index.ts:30-36`

**Symptôme :** L'email de confirmation double opt-in est HTML-only. Pas de fallback texte.

**Risque :** Spam score plus élevé sur certains filtres + client text-only ne voit rien.

**Fix proposé :** Une fois le finding #2 résolu (`sendEmail` supporte `text`), passer un plaintext simple : "Pour confirmer votre inscription à la newsletter TrottiStore, cliquez sur ce lien : {confirmUrl}"

## Non-findings (vérifié, OK)

- ✓ Retry/fallback SMTP→Brevo fonctionne (`transport.ts:35-45`)
- ✓ SMS graceful failure si pas de `BREVO_API_KEY` (`sms.ts:47-49`)
- ✓ Fire-and-forget accepté pour dette technique (déjà documenté A9-01 et architecture audit 1.6)
- ✓ Reply-to headers non nécessaires (transactionnels, pas marketing)
- ✓ Pas de tracking pixels (OK pour RGPD)
- ✓ Unsubscribe pas pertinent pour transactionnels
- ✓ Tokens reset/confirm générés cryptographiquement (`randomUUID` ou `randomBytes`)
- ✓ Double opt-in newsletter avec auto-confirm fallback en dev (ligne 69)

## Angles non vérifiés

- DKIM/SPF/DMARC config (pas dans code, c'est DevOps/DNS)
- Bounce handling webhooks Brevo (nécessite route webhook côté services)
- Throttling/rate limiting Brevo (API quotas non vérifiés)
- Mobile rendering des templates HTML (nécessite vérif visuelle)
- Localization (tous les emails hardcodés FR, pas de fallback EN)

## Recommandations

### IMMÉDIAT (P1 — < 1h)
- **Ajouter `htmlEscape()` et l'appliquer à tous les noms/prénoms dans templates.ts**

### Court terme (P2 — 1-2h)
- Étendre `sendEmail()` pour accepter `text` optionnel + générer plaintext dégradé
- Centraliser `BASE_URL` et `SENDER_EMAIL` en `packages/shared/src/config.ts`

### Moyen terme (P2 — 1 jour)
- Ajouter `email_audit_log` (ou étendre `notification_logs`) pour ecommerce/auth

### Post go-live
- Implémenter retry avec BullMQ + webhook bounce handling Brevo (architecture B5)
- Localization i18n des templates (si on attaque l'international)
