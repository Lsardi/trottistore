# Audit Methodology — Moon-Rocket Grade

> "Quality is not an act, it is a habit." — Aristotle (cité dans la spec NASA-STD-8719.13)

Ce document décrit la **méthodologie complète** pour auditer TrottiStore **comme si on envoyait une fusée sur la lune** : chaque composant inspecté, vérifié, testé par **plusieurs méthodes indépendantes**, zéro tolérance pour les angles morts.

Inspiré de :
- NASA NPR 7150.2 (Software Engineering Requirements)
- NASA-STD-8719.13 (Software Safety Standard)
- Power of 10 (Gerard Holzmann, JPL)
- OWASP ASVS Level 3
- PCI-DSS v4.0 (paiements)
- Toyota's "5 Whys" + "Stop the line"

---

## Principe central — Defense in depth

> Aucune méthode ne suffit seule. Chaque chose critique doit être validée par **au moins 2 mécanismes indépendants**.

Pour chaque finding, on doit pouvoir répondre **oui** à toutes ces questions :
1. Le code existe-t-il vraiment à cette ligne ? (lecture humaine)
2. Un outil automatique le détecte-t-il ? (SAST / lint)
3. Existe-t-il un test qui échoue à cause de ce bug ? (red test)
4. Le test passe-t-il après le fix ? (green test)
5. Le test resterait-il valide après refactor ? (mutation testing)
6. Le bug est-il documenté dans un ADR ou une issue ? (traçabilité)
7. La régression est-elle prévenue par CI ? (gate)

Si une seule réponse est non → l'audit n'est pas terminé sur ce point.

---

## Les 7 couches de vérification

```
┌────────────────────────────────────────────────┐
│ Layer 7 — Penetration testing (humain)         │
├────────────────────────────────────────────────┤
│ Layer 6 — Threat modeling (STRIDE)             │
├────────────────────────────────────────────────┤
│ Layer 5 — Property-based + fuzz + chaos        │
├────────────────────────────────────────────────┤
│ Layer 4 — Integration tests + smoke + E2E      │
├────────────────────────────────────────────────┤
│ Layer 3 — Unit tests + mutation testing        │
├────────────────────────────────────────────────┤
│ Layer 2 — SAST + DAST + SCA                    │
├────────────────────────────────────────────────┤
│ Layer 1 — Type checking + lint                 │
└────────────────────────────────────────────────┘
```

Chaque layer attrape des classes de bugs différentes. Aucun layer n'est facultatif pour un système qui prend de l'argent.

---

## Layer 1 — Type checking + lint

**Objectif :** zéro `any` non justifié, zéro variable non utilisée, zéro erreur de typage.

```bash
# TypeScript le plus strict possible
pnpm tsc --noEmit \
  --strict \
  --noUncheckedIndexedAccess \
  --noImplicitOverride \
  --noPropertyAccessFromIndexSignature \
  --exactOptionalPropertyTypes \
  --useUnknownInCatchVariables

# ESLint avec rules sécurité
pnpm eslint . \
  --ext .ts,.tsx \
  --max-warnings 0
```

**Plugins ESLint à exiger :**
- `@typescript-eslint/strict-type-checked`
- `eslint-plugin-security` (regex catastrophiques, eval, child_process)
- `eslint-plugin-no-unsanitized` (DOM injection)
- `eslint-plugin-promise` (Promise sans .catch, return manquants)
- `eslint-plugin-import` (cycles, exports manquants)
- `eslint-plugin-functional` (immutabilité optionnelle)

**Gate CI :** `pnpm tsc --noEmit && pnpm lint` doit passer en zéro warning.

**Couvre :** typos, fuites de types, retours manquants, arguments dans le mauvais ordre, dead imports.  
**Ne couvre pas :** logique métier, sécurité runtime, race conditions, business invariants.

---

## Layer 2 — SAST + DAST + SCA

### SAST — analyse statique sécurité

3 outils en parallèle pour cross-validation ([source : code-quality.io 2026](https://www.code-quality.io/best-typescript-tools-for-developers-in-2026), [Snyk vs CodeQL 2026](https://dev.to/rahulxsingh/snyk-vs-codeql-free-sast-tools-compared-2026-4bp7)) :

| Outil | Force | Faiblesse | Coût |
|---|---|---|---|
| **Semgrep** | rules custom faciles, rapide CI, ruleset OWASP / Stripe | parfois faux positifs sur taint | gratuit OSS |
| **CodeQL** | analyse sémantique profonde (data flow), custom queries | lent, courbe d'apprentissage | gratuit pour OSS |
| **Snyk Code** | DX moderne, IA, suggestions de fix | propriétaire, quotas | freemium |

```bash
# Semgrep avec rulesets explicites
semgrep --config p/owasp-top-ten \
        --config p/javascript \
        --config p/typescript \
        --config p/nodejs \
        --config p/jwt \
        --config p/sql-injection \
        --error \
        --strict \
        services/ apps/ packages/

# CodeQL via GitHub Actions ou CLI local
codeql database create db --language=javascript --source-root=.
codeql database analyze db --format=sarif-latest --output=results.sarif \
       javascript-security-and-quality.qls

# Snyk Code (CLI)
snyk code test --severity-threshold=high
```

**Custom Semgrep rules à écrire pour TrottiStore :**

```yaml
# .semgrep/no-prisma-update-without-where-userid.yml
rules:
  - id: prisma-update-without-userid
    pattern: |
      $APP.prisma.$MODEL.update({
        where: { id: $ID },
        ...
      })
    message: "Prisma update by id without userId scope — possible IDOR"
    languages: [typescript]
    severity: ERROR
    
  - id: float-math-on-decimal
    pattern-either:
      - pattern: Number($X.priceHt) * $Y
      - pattern: Number($X.totalTtc) * $Y
      - pattern: Math.round($X * 100) / 100
    message: "Float arithmetic on Decimal field — use new Decimal() and .mul()"
    severity: ERROR

  - id: stock-decrement-outside-transaction
    pattern: |
      $APP.prisma.productVariant.update({
        ...
        data: { stockQuantity: { decrement: $N } }
      })
    pattern-not-inside: |
      $APP.prisma.$transaction(...)
    severity: ERROR
```

Toute custom rule trouvée par cet audit doit être codifiée et versionnée.

### DAST — analyse dynamique runtime

```bash
# OWASP ZAP en mode baseline (smoke runtime)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r zap-report.html

# Burp Suite Professional (manuel) pour tests approfondis
# Stripe webhook replay
stripe trigger payment_intent.succeeded \
  --override 'metadata[orderId]=<volé>'
```

### SCA — vulnérabilités dépendances

```bash
pnpm audit --audit-level=high
npx snyk test --severity-threshold=high
npx npm-check-updates --target=minor
# Bonus : Socket.dev pour détecter les supply chain attacks
npx @socketsecurity/cli scan
```

**Gate CI :** zéro CVE ≥ high. Snapshot de toutes les versions dans `pnpm-lock.yaml` committé.

---

## Layer 3 — Unit tests + mutation testing

### Unit tests — invariants métier

Tests par fichier, isolation totale, mocks pour DB / Redis / Stripe.

```bash
pnpm vitest run --coverage \
  --coverage.thresholds.lines=90 \
  --coverage.thresholds.branches=85 \
  --coverage.thresholds.functions=90
```

**Règle d'or :** chaque branche `if/else`, chaque `catch`, chaque early return doit avoir un test qui l'exerce.

### Mutation testing — Stryker

Stryker mute volontairement le code (change `>` en `>=`, supprime un `!`, etc.) et vérifie qu'**au moins un test échoue**. Si tous les tests passent malgré la mutation → le test ne couvre pas vraiment ce code.

```bash
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm stryker run
```

**Cible NASA-grade :** mutation score ≥ 80 % sur les paths critiques (checkout, auth, stock, payment).

C'est la **seule façon** de prouver que les tests sont vraiment utiles et pas juste du theater.

---

## Layer 4 — Integration tests + smoke + E2E

### Integration (Vitest avec Prisma test DB)

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgres://test:test@localhost:5433/test pnpm vitest --project ecommerce
```

Tests qui :
- Touchent une vraie DB (pas mockée)
- Lancent une vraie transaction
- Exécutent des requêtes Prisma réelles
- Vérifient le contrat de réponse (`{success, data, error}`)

### Smoke tests post-deploy

Le runbook (`RELEASE_RUNBOOK.md`) doit lancer :

```bash
# /health doit répondre 200 sur les 4 services
for port in 3001 3002 3003 3004; do
  curl -fsS http://localhost:$port/health || exit 1
done

# Critical happy paths
pnpm test:smoke   # ~18 tests, ~1s
```

### E2E (Playwright)

```bash
pnpm playwright test \
  --reporter=html \
  --workers=4 \
  --retries=2

# Avec traces et videos en cas de fail
pnpm playwright test --trace on-first-retry --video retain-on-failure
```

**Cible :** tous les funnels critiques :
1. Signup → confirm email → login
2. Browse → add to cart → checkout (auth) → Stripe → confirm
3. Browse → add to cart → checkout (guest) → Stripe → confirm
4. Login → reset password → re-login
5. Admin → create product → publish → buy → cancel → refund

---

## Layer 5 — Property-based + fuzz + chaos

### Property-based testing — fast-check

L'approche : au lieu d'écrire des cas concrets, écrire des **propriétés invariantes** que le code doit satisfaire pour **toute entrée valide**.

```ts
import * as fc from "fast-check";
import { computeCartTotal } from "../src/cart";

test("le total = somme des lignes (toujours)", () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        unitPriceHt: fc.float({ min: 0.01, max: 9999, noNaN: true }),
        quantity: fc.integer({ min: 1, max: 100 }),
      })),
      (items) => {
        const total = computeCartTotal(items);
        const sum = items.reduce(
          (s, i) => s.add(new Decimal(i.unitPriceHt).mul(i.quantity)),
          new Decimal(0)
        );
        return total.equals(sum); // ← propriété
      }
    )
  );
});

test("le stock ne peut jamais aller négatif", () => {
  fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 100 }), // stock initial
      fc.array(fc.integer({ min: 1, max: 50 })), // commandes
      async (initialStock, orderQuantities) => {
        await db.productVariant.update({ where: {...}, data: { stockQuantity: initialStock } });
        await Promise.allSettled(
          orderQuantities.map(qty => createOrder({ variantId, qty }))
        );
        const final = await db.productVariant.findUnique({ where: {...} });
        return final.stockQuantity >= 0; // ← invariant fondamental
      }
    )
  );
});
```

fast-check **shrink** automatiquement le contre-exemple : tu obtiens le plus petit input qui casse l'invariant. C'est ainsi qu'on aurait trouvé le **stock race oversell** sans même y penser.

### Fuzz testing — entrées aléatoires sur parsers

```bash
# Pour parsers JSON, querystrings, headers
pnpm add -D @fast-check/jest

# Ou Jazzer.js pour fuzzing à coverage feedback
npx jazzer fuzz target.js
```

### Chaos engineering — failure injection

```bash
# Toxiproxy pour injecter latence / drops réseau entre app et Postgres
docker run -d --name toxiproxy ghcr.io/shopify/toxiproxy
toxiproxy-cli create -l 0.0.0.0:5433 -u localhost:5432 db
toxiproxy-cli toxic add db -t latency -a latency=2000 -a jitter=500
# Puis lancer la suite E2E → le checkout doit timeout proprement, pas corrompre l'état
```

---

## Layer 6 — Threat modeling (STRIDE)

Pour chaque endpoint, et chaque flow utilisateur, énumérer **systématiquement** les 6 catégories de menace :

| Lettre | Menace | Question |
|---|---|---|
| **S**poofing | Identité usurpée | "Qui est l'appelant ? L'a-t-on cryptographiquement vérifié ?" |
| **T**ampering | Données modifiées | "Le payload peut-il être modifié en transit ou en stockage ?" |
| **R**epudiation | Action niée | "Y a-t-il un audit log signé de cette action ?" |
| **I**nformation disclosure | Fuite | "Qui peut lire cette donnée ? Est-ce le bon scope ?" |
| **D**oS | Indisponibilité | "Une seule requête peut-elle paralyser le système ?" |
| **E**levation | Privilege escalation | "Cette action peut-elle obtenir plus de droits qu'elle n'a ?" |

**Application à TrottiStore :** créer `THREAT_MODEL.md` avec une ligne par endpoint × 6 menaces. Chaque case doit être ✅ (mitigé) ou ⚠️ (accepté avec justification) ou ❌ (à fixer).

Exemple :
```
POST /checkout/payment-intent (guest)
  S: ✅ session id Redis-bound to orderId
  T: ✅ amount calculated server-side from DB
  R: ⚠️  payment is logged in audit_log table
  I: ✅ only returns clientSecret + amount, no PII
  D: ⚠️  rate limit 5/min — RAISE TO 2/min
  E: ✅ guest cannot trigger admin endpoints
```

---

## Layer 7 — Penetration testing (humain)

Une fois par trimestre, ou avant chaque release majeure :

1. **Pentester externe** (1-2 jours), focus paiement et auth
2. **Bug bounty** (HackerOne, Intigriti) en mode privé
3. **Code review formel** par un humain qui n'a pas écrit le code

Aucun outil ne remplace un humain qui pense comme un attaquant.

---

## Stratégie multi-LLM cross-validation

C'est ce qu'on a fait aujourd'hui — formaliser :

### Règle 1 — Atomicité

**Une question = un agent.** Pas de "audit-moi tout le projet". Chaque agent reçoit :
- Une seule question fermée (`Is X true ?`)
- La liste exacte des fichiers à lire (chemins absolus)
- Un format de sortie strict (JSON ou table markdown)
- Une consigne explicite de **citer le code**

### Règle 2 — Code quoté obligatoire

Chaque finding doit contenir **2-5 lignes du code source réel** et un `file:line`. Sans citation → pas de finding.

### Règle 3 — Vérification humaine des P0

Avant d'écrire un fix ou un commit, **lire à la main** les lignes citées par l'agent. Les LLMs hallucinent. Toujours.

### Règle 4 — Cross-validation

Lancer **2-3 agents indépendants** sur la même question. Ne flagger que si **N agents agree**. Aujourd'hui :
- 7 findings confirmés par 2-3 audits indépendants → fiabilité maximale
- 4 findings flagués par 1 seul audit → 100 % faux positifs après vérification

### Règle 5 — Adversarial agent

Un agent dont le seul job est de **disprouver** un finding existant. Si l'adversarial agent ne trouve pas de raison de rejeter → le finding est solide.

```
Tu es un avocat de la défense. Voici un finding :
"X est un bug parce que Y."
Lis le code et trouve **3 raisons** pourquoi ce n'est PAS un bug.
Si tu ne trouves aucune raison, dis "FINDING CONFIRMED".
```

### Règle 6 — Sourcing des claims

Toute recommandation tooling doit citer une source web datée 2025-2026.

---

## Pipeline CI complet (gate avant merge)

```yaml
# .github/workflows/audit-gate.yml (extrait)
jobs:
  layer-1-types-lint:
    steps:
      - run: pnpm tsc --noEmit
      - run: pnpm eslint . --max-warnings 0

  layer-2-sast:
    steps:
      - run: semgrep --config p/owasp-top-ten --error
      - run: snyk code test --severity-threshold=high
      - run: pnpm audit --audit-level=high
      - uses: github/codeql-action/analyze@v3

  layer-3-unit-mutation:
    steps:
      - run: pnpm vitest run --coverage
      - run: pnpm stryker run --threshold-break=80

  layer-4-integration-e2e:
    steps:
      - run: docker compose -f docker-compose.test.yml up -d
      - run: pnpm test:integration
      - run: pnpm playwright test

  layer-5-properties:
    steps:
      - run: pnpm test:properties
      - run: pnpm test:fuzz --duration=300s

  ci-gate:
    needs: [layer-1-types-lint, layer-2-sast, layer-3-unit-mutation, layer-4-integration-e2e, layer-5-properties]
    steps:
      - run: echo "All 5 automated layers green — merge allowed"
```

Layers 6 (threat model) et 7 (pentest) sont **manuels et hors CI**. Ils tournent sur cadence.

---

## Définition de "audité" pour TrottiStore

Un fichier / endpoint / flow est **audité** quand :

- [ ] Layer 1 (types + lint) passe en zéro warning
- [ ] Layer 2 (SAST + DAST + SCA) passe en zéro high
- [ ] Layer 3 (unit + mutation ≥ 80 %) passe
- [ ] Layer 4 (integration + smoke + E2E) couvre les paths critiques
- [ ] Layer 5 (au moins 1 property test sur les invariants)
- [ ] Layer 6 (entrée dans `THREAT_MODEL.md`)
- [ ] Layer 7 (revue humaine indépendante au moins 1 fois)
- [ ] CI a un gate qui empêche la régression

Aucun de ces critères ne suffit seul. **Tous** doivent être verts.

---

## Application immédiate à TrottiStore

### Cibles "lune" pour le sprint en cours

| Domaine | Layers manquantes | Action |
|---|---|---|
| Stock / inventory | 5 (property), 6 (threat), CI gate | écrire `tests/properties/stock.test.ts`, ajouter custom Semgrep rule |
| Checkout / payment | 5 (property), 7 (pentest) | property tests sur Decimal, planifier pentest externe |
| Auth / RBAC | 6 (threat) | écrire `THREAT_MODEL.md` section auth |
| Customer merge | 3 (unit + mutation), 4 (integration) | tests Vitest avec test DB pour le merge |

### Outils à installer (toolchain unique)

```bash
# Layer 2
pnpm add -D semgrep
brew install semgrep  # ou pip
gh extension install github/codeql-cli

# Layer 3
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner

# Layer 5
pnpm add -D fast-check @fast-check/vitest
```

### Custom Semgrep rules à committer dès maintenant

`.semgrep/trottistore.yml` avec au minimum :
1. `prisma-update-without-userid` — IDOR detector
2. `float-math-on-money` — Decimal enforcement
3. `stock-mutation-outside-transaction` — race detector
4. `no-as-any-in-route-handler` — Zod enforcement
5. `webhook-secret-fail-open` — Stripe webhook safety
6. `localStorage-token` — token storage policy
7. `query-raw-with-template` — guide Prisma template literals (autorisé) vs string concat (interdit)

---

## Conclusion

Auditer "comme une fusée lune" = **multiplier les méthodes indépendantes** sur le même code, **automatiser tout ce qui peut l'être**, et **garder l'humain pour les questions que la machine ne sait pas poser**.

Aucun seul outil n'est assez. Aucun seul agent LLM n'est assez. Aucun seul humain n'est assez. **L'union est le seul filet sans trou.**

> "Test what you fly. Fly what you test." — NASA
