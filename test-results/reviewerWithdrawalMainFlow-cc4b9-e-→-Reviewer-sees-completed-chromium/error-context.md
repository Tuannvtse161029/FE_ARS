# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reviewerWithdrawalMainFlow.spec.ts >> main flow: Reviewer zero-VND withdrawal → Admin approve → receipt upload → complete → Reviewer sees completed
- Location: src\tests\e2e\reviewerWithdrawalMainFlow.spec.ts:392:1

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Page snapshot

```yaml
- generic [ref=f98e3]:
  - complementary [ref=f98e4]:
    - img "ARS Platform Logo" [ref=f98e7]
    - navigation [ref=f98e8]:
      - link "Forums" [ref=f98e9] [cursor=pointer]:
        - /url: /forum
      - link "Review Paper 2" [ref=f98e14] [cursor=pointer]:
        - /url: /review-tasks
        - generic [ref=f98e19]: Review Paper
        - generic [ref=f98e20]: "2"
      - link "Wallet & Withdrawals" [ref=f98e21] [cursor=pointer]:
        - /url: /earnings-wallet
  - generic [ref=f98e27]:
    - banner [ref=f98e28]:
      - textbox "Search Papers..." [ref=f98e34]
      - generic [ref=f98e35]:
        - generic [ref=f98e36]:
          - button "Turn off availability" [pressed] [ref=f98e37] [cursor=pointer]
          - generic [ref=f98e39]: Available
        - generic [ref=f98e40]: 1.500.000 VND
        - button "3" [ref=f98e46] [cursor=pointer]
        - button "DN Dr. Nguyen Van A Reviewer" [ref=f98e52] [cursor=pointer]:
          - generic [ref=f98e53]: DN
          - generic [ref=f98e54]:
            - generic [ref=f98e55]: Dr. Nguyen Van A
            - generic [ref=f98e56]: Reviewer
    - main [ref=f98e59]:
      - generic [ref=f98e61]:
        - complementary [ref=f98e62]:
          - heading "FORUM" [level=1] [ref=f98e63]
          - generic [ref=f98e64]:
            - generic [ref=f98e65]: Categories
            - generic [ref=f98e66]:
              - button "All Posts" [ref=f98e67] [cursor=pointer]
              - button "My Posts" [ref=f98e71] [cursor=pointer]
              - button "Following" [ref=f98e74] [cursor=pointer]
          - generic [ref=f98e79]:
            - generic [ref=f98e80]: Filters
            - generic [ref=f98e82]:
              - generic [ref=f98e83]: Author
              - textbox "Search author..." [ref=f98e84]
        - generic [ref=f98e85]:
          - generic [ref=f98e86]:
            - generic [ref=f98e87]:
              - heading "PUBLIC FORUM" [level=2] [ref=f98e88]
              - generic [ref=f98e89]: 5 posts
              - button "+ Create Post" [ref=f98e90] [cursor=pointer]
            - combobox [ref=f98e92] [cursor=pointer]:
              - option "Newest" [selected]
              - option "Most Discussed"
              - option "Most Viewed"
          - generic [ref=f98e93]:
            - generic [ref=f98e94] [cursor=pointer]:
              - generic [ref=f98e95]:
                - generic [ref=f98e96]: NA
                - generic [ref=f98e97]:
                  - generic [ref=f98e98]: Dr. Nguyen Van A
                  - generic [ref=f98e99]: 2h ago
              - heading "A Modular Backend Network Protocol for High-Throughput Storage" [level=3] [ref=f98e100]
              - paragraph [ref=f98e101]: This paper presents a modular backend network protocol engineered specifically for high-throughput distributed storage environments. The proposed framework decouples data ingestion, routing, and persistence layers into independently scalable service units.
              - generic [ref=f98e102]:
                - generic [ref=f98e103]: "#SoftwareEngineering"
                - generic [ref=f98e104]: "#Networks"
              - generic [ref=f98e105]:
                - generic [ref=f98e106]: "24"
                - generic [ref=f98e109]: "8"
                - generic [ref=f98e112]: "312"
            - generic [ref=f98e116] [cursor=pointer]:
              - generic [ref=f98e117]:
                - generic [ref=f98e118]: LB
                - generic [ref=f98e119]:
                  - generic [ref=f98e120]: Prof. Le Thi B
                  - generic [ref=f98e121]: 5h ago
                - button "Follow" [ref=f98e122]
              - heading "Transformer-Based Models for Low-Resource Languages" [level=3] [ref=f98e123]
              - paragraph [ref=f98e124]: We explore transfer learning strategies using transformer architectures adapted for low-resource languages. Our approach achieves competitive results with 60% less labeled data compared to baseline models trained from scratch.
              - generic [ref=f98e125]:
                - generic [ref=f98e126]: "#NLP"
                - generic [ref=f98e127]: "#MachineLearning"
              - generic [ref=f98e128]:
                - generic [ref=f98e129]: "41"
                - generic [ref=f98e132]: "15"
                - generic [ref=f98e135]: "589"
            - generic [ref=f98e139] [cursor=pointer]:
              - generic [ref=f98e140]:
                - generic [ref=f98e141]: RX
                - generic [ref=f98e142]:
                  - generic [ref=f98e143]: Researcher_XYZ
                  - generic [ref=f98e144]: 1d ago
                - button "Follow" [ref=f98e145]
              - heading "Quantum Computing Applications in Cryptography" [level=3] [ref=f98e146]
              - paragraph [ref=f98e147]: An investigation into post-quantum cryptographic algorithms suitable for deployment in financial systems. We evaluate lattice-based and hash-based schemes under simulated quantum attack scenarios.
              - generic [ref=f98e148]:
                - generic [ref=f98e149]: "#QuantumComputing"
                - generic [ref=f98e150]: "#Cryptography"
              - generic [ref=f98e151]:
                - generic [ref=f98e152]: "17"
                - generic [ref=f98e155]: "4"
                - generic [ref=f98e158]: "203"
            - generic [ref=f98e162] [cursor=pointer]:
              - generic [ref=f98e163]:
                - generic [ref=f98e164]: RD
                - generic [ref=f98e165]:
                  - generic [ref=f98e166]: Researcher_DV
                  - generic [ref=f98e167]: 2d ago
                - button "Follow" [ref=f98e168]
              - heading "Advances in Federated Learning for Privacy-Preserving AI" [level=3] [ref=f98e169]
              - paragraph [ref=f98e170]: We introduce a novel differential privacy mechanism integrated into the federated averaging algorithm, enabling stronger privacy guarantees without significant accuracy trade-offs in healthcare data applications.
              - generic [ref=f98e171]:
                - generic [ref=f98e172]: "#MachineLearning"
                - generic [ref=f98e173]: "#Privacy"
              - generic [ref=f98e174]:
                - generic [ref=f98e175]: "56"
                - generic [ref=f98e178]: "22"
                - generic [ref=f98e181]: "941"
            - generic [ref=f98e185] [cursor=pointer]:
              - generic [ref=f98e186]:
                - generic [ref=f98e187]: TC
                - generic [ref=f98e188]:
                  - generic [ref=f98e189]: Dr. Tran Van C
                  - generic [ref=f98e190]: 3d ago
                - button "Follow" [ref=f98e191]
              - heading "Energy-Efficient Routing Protocols for IoT Networks" [level=3] [ref=f98e192]
              - paragraph [ref=f98e193]: This work proposes a cluster-based routing protocol that dynamically adjusts transmission power based on residual energy levels, extending network lifetime by up to 40% compared to LEACH in large-scale IoT deployments.
              - generic [ref=f98e194]:
                - generic [ref=f98e195]: "#IoT"
                - generic [ref=f98e196]: "#Networks"
              - generic [ref=f98e197]:
                - generic [ref=f98e198]: "33"
                - generic [ref=f98e201]: "11"
                - generic [ref=f98e204]: "478"
```

# Test source

```ts
  100 | 
  101 | const RUN_LIVE = process.env.E2E_RUN_LIVE_WITHDRAWAL_FLOW === 'true';
  102 | 
  103 | // ── Env-var guard (per §D "Missing env vars") ───────────────────────────────
  104 | 
  105 | const REQUIRED_ENV = [
  106 |   ['E2E_REVIEWER_EMAIL', REVIEWER_EMAIL],
  107 |   ['E2E_REVIEWER_PASSWORD', REVIEWER_PASSWORD],
  108 |   ['E2E_ADMIN_EMAIL', ADMIN_EMAIL],
  109 |   ['E2E_ADMIN_PASSWORD', ADMIN_PASSWORD],
  110 | ];
  111 | 
  112 | // We only fail loudly if every value is missing — i.e. the user explicitly
  113 | // disabled the defaults by clearing the env. Otherwise we fall back to the
  114 | // documented FAST_LOGIN_USERS seeds.
  115 | const ALL_ENV_MISSING = REQUIRED_ENV.every(([, v]) => !v);
  116 | 
  117 | // ── Fixtures & paths ─────────────────────────────────────────────────────────
  118 | 
  119 | const __filename = fileURLToPath(import.meta.url);
  120 | 
  121 | let scenario: WithdrawalFlowScenario;
  122 | test.beforeAll(() => {
  123 |   scenario = makeWithdrawalScenario();
  124 |   test.setTimeout(180_000);
  125 | });
  126 | 
  127 | // ── Selectors (per lead directive — finalized AFTER Admin interface ready,
  128 | //    but stable per the inspected code paths) ────────────────────────────────
  129 | 
  130 | const SEL = {
  131 |   // Reviewer form
  132 |   reviewerCreateBtn:
  133 |     'button:has-text("Create New Request"), button:has-text("Create your first request")',
  134 |   reviewerCreateModalTitle: 'h3:has-text("Submit Withdrawal Request")',
  135 |   reviewerBankSelect: 'select',
  136 |   reviewerAccountNameInput: 'input[placeholder*="account holder"]',
  137 |   reviewerAccountNumberInput: 'input[placeholder*="bank account number"]',
  138 |   reviewerAmountInput: 'input[type="number"]',
  139 |   reviewerNarrative: 'textarea',
  140 |   reviewerSendBtn: 'button[type="submit"]:has-text("Send Request")',
  141 |   reviewerCancelBtn: 'button:has-text("Cancel")',
  142 |   reviewerSuccessModal: 'h2:has-text("Withdrawal Request Submitted!")',
  143 |   reviewerTable: 'table',
  144 |   reviewerViewBtn: 'button:has-text("View")',
  145 |   // Admin
  146 |   adminWithdrawalsTab: 'button[role="tab"]:has-text("Reviewer Withdrawal Requests")',
  147 |   adminViewDetailsBtn: 'button:has-text("View Details")',
  148 |   adminApproveBtn:
  149 |     'button:has-text("Approve & Pay"), button:has-text("Complete Transfer")',
  150 |   adminDenyBtn: 'button:has-text("Deny")',
  151 |   adminConfirmBtn: 'button:has-text("Confirm Transfer & Send Proof")',
  152 |   adminReceiptInput: 'input[type="file"]',
  153 |   adminReceiptPreviewImg: 'img[alt*="Preview"]',
  154 |   adminViewReceiptLink: 'a:has-text("View Receipt")',
  155 |   // Cross-role
  156 |   roleSelectionModal:
  157 |     '[role="dialog"][aria-labelledby="role-selection-title"]',
  158 |   signOutStorageKeys: ['ars_token', 'ars_user'],
  159 | };
  160 | 
  161 | // ── Helpers ──────────────────────────────────────────────────────────────────
  162 | 
  163 | /**
  164 |  * Install the page-level dialog auto-dismisser so the live form's
  165 |  * `alert('Please enter a valid amount.')` (EarningsWallet.tsx:86) and
  166 |  * other confirmation alerts don't block the test.
  167 |  */
  168 | function dismissDialogs(page: Page) {
  169 |   page.on('dialog', (dialog) => {
  170 |     test.info().annotations.push({
  171 |       type: 'PAGE_DIALOG',
  172 |       description: `${dialog.type()}: ${dialog.message().slice(0, 200)}`,
  173 |     });
  174 |     void dialog.dismiss().catch(() => undefined);
  175 |   });
  176 | }
  177 | 
  178 | /**
  179 |  * The Vercel SPA hydration is slow on cold cache and even slower after a
  180 |  * sign-out redirect loop. Strategy:
  181 |  *   1) navigate to /login (waitUntil: 'load' so the SPA's JS bundles
  182 |  *      are downloaded before we attempt to interact),
  183 |  *   2) wait for `document.readyState` to settle,
  184 |  *   3) wait for `input[name="username"]` to attach AND be visible.
  185 |  *   4) If still missing, dump `document.title`, `location.href`, and the
  186 |  *      body's outerHTML snippet into test annotations for forensic review.
  187 |  */
  188 | async function waitForLoginForm(page: Page): Promise<void> {
  189 |   await page.waitForFunction(
  190 |     () => document.readyState === 'complete',
  191 |     undefined,
  192 |     { timeout: 30_000 },
  193 |   );
  194 |   const usernameInput = page.locator('input[name="username"]');
  195 |   try {
  196 |     await usernameInput.waitFor({ state: 'attached', timeout: 30_000 });
  197 |     await usernameInput.waitFor({ state: 'visible', timeout: 15_000 });
  198 |   } catch {
  199 |     // Dump forensic state to help diagnose cold-cache hydration issues.
> 200 |     const dump = await page.evaluate(() => ({
      |                             ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
  201 |       title: document.title,
  202 |       href: location.href,
  203 |       readyState: document.readyState,
  204 |       bodyClass: document.body.className,
  205 |       bodySnippet: (document.body.outerHTML ?? '').slice(0, 600),
  206 |     }));
  207 |     test.info().annotations.push({
  208 |       type: 'LOGIN_FORM_MISSING',
  209 |       description: JSON.stringify(dump),
  210 |     });
  211 |     throw new Error(
  212 |       `Login form input never appeared. href=${dump.href} title=${dump.title}`,
  213 |     );
  214 |   }
  215 | }
  216 | 
  217 | async function loginAs(
  218 |   page: Page,
  219 |   email: string,
  220 |   password: string,
  221 |   role: string,
  222 | ): Promise<void> {
  223 |   await page.goto('/login', { waitUntil: 'load' });
  224 |   await waitForLoginForm(page);
  225 |   const usernameInput = page.locator('input[name="username"]');
  226 |   await usernameInput.fill(email);
  227 |   await page.locator('input[name="password"]').fill(password);
  228 |   await Promise.all([
  229 |     page
  230 |       .waitForURL((u) => !/\/login\b/.test(u.pathname), { timeout: 30_000 })
  231 |       .catch(() => undefined),
  232 |     page.click('button[type="submit"]:has-text("Sign in")'),
  233 |   ]);
  234 |   const modal = page.locator(SEL.roleSelectionModal);
  235 |   if (await modal.isVisible().catch(() => false)) {
  236 |     const radio = modal.locator(`input[type="radio"][value="${role}"]`).first();
  237 |     if (await radio.isVisible().catch(() => false)) {
  238 |       await radio.check().catch(() => undefined);
  239 |     }
  240 |     await modal
  241 |       .locator('button:has-text("Continue as")')
  242 |       .click({ timeout: 5_000 })
  243 |       .catch(() => undefined);
  244 |     await modal.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  245 |   }
  246 |   await page.waitForFunction(
  247 |     (expectedRole: string) => {
  248 |       try {
  249 |         const raw = localStorage.getItem('ars_user');
  250 |         if (!raw) return false;
  251 |         const parsed = JSON.parse(raw) as { roleName?: string };
  252 |         return parsed.roleName === expectedRole;
  253 |       } catch {
  254 |         return false;
  255 |       }
  256 |     },
  257 |     role,
  258 |     { timeout: 10_000 },
  259 |   );
  260 | }
  261 | 
  262 | async function signOut(page: Page) {
  263 |   await page.evaluate(() => {
  264 |     try {
  265 |       Object.keys(localStorage)
  266 |         .filter((k) => k.startsWith('ars_'))
  267 |         .forEach((k) => localStorage.removeItem(k));
  268 |       Object.keys(sessionStorage)
  269 |         .filter((k) => k.startsWith('ars_'))
  270 |         .forEach((k) => sessionStorage.removeItem(k));
  271 |     } catch {
  272 |       /* ignore */
  273 |     }
  274 |   });
  275 |   // Force a hard reload to flush any in-memory React/Zustand state held
  276 |   // over from the previous role. Bouncing to `about:blank` first ensures
  277 |   // the SPA is fully unmounted before we re-navigate to /login fresh —
  278 |   // otherwise the cached `isAuthenticated: true` may keep `PublicRoute`
  279 |   // bouncing the user to /forum instead of rendering the Login form.
  280 |   await page.context().clearCookies().catch(() => undefined);
  281 |   await page.goto('about:blank').catch(() => undefined);
  282 |   await page.goto('/login', { waitUntil: 'load' });
  283 |   await waitForLoginForm(page);
  284 | }
  285 | 
  286 | /**
  287 |  * Find a row by tx/request id text. We do NOT rely on row position —
  288 |  * we look for the unique `#WR-XXXXXXX` / `#XXXX` text and click the
  289 |  * sibling action button within the same row.
  290 |  */
  291 | async function clickActionInRow(
  292 |   page: Page,
  293 |   rowMatcher: string,
  294 |   actionText: string,
  295 | ) {
  296 |   const cell = page.locator(`td:has-text("${rowMatcher}")`).first();
  297 |   await expect(cell).toBeVisible({ timeout: 20_000 });
  298 |   const row = cell.locator('xpath=ancestor::tr[1]');
  299 |   await row.locator(`button:has-text("${actionText}")`).first().click();
  300 | }
```