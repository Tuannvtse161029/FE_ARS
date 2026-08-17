# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: researcherReviewerMainFlow.spec.ts >> main flow final decision: Reject
- Location: src\tests\e2e\researcherReviewerMainFlow.spec.ts:193:1

# Error details

```
TimeoutError: page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "https://fe-ars.vercel.app/login", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e8]:
  - generic [ref=e9]:
    - img "ARS Logo" [ref=e10]
    - generic [ref=e11]: Academic Research Sharing
  - heading "Nice to see you again" [level=1] [ref=e13]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]: Login
      - textbox "Login" [ref=e18]:
        - /placeholder: Email or phone number
    - generic [ref=e20]:
      - generic [ref=e21]: Password
      - generic [ref=e22]:
        - textbox "Password" [ref=e23]:
          - /placeholder: Enter password
        - button [ref=e25] [cursor=pointer]
    - generic [ref=e29]:
      - generic [ref=e30] [cursor=pointer]: Remember me
      - link "Forgot password?" [ref=e33] [cursor=pointer]:
        - /url: /forgot-password
    - button "Sign in" [ref=e34] [cursor=pointer]
    - button "Or sign in with Google" [ref=e35] [cursor=pointer]
    - generic [ref=e42]: Dev only
    - generic [ref=e46]:
      - button "Researcher" [ref=e47] [cursor=pointer]
      - button "Reviewer" [ref=e48] [cursor=pointer]
      - button "Admin" [ref=e49] [cursor=pointer]
      - button "Lecturer" [ref=e50] [cursor=pointer]
      - button "Grad Student" [ref=e51] [cursor=pointer]
    - paragraph [ref=e53]:
      - text: Dont have an account?
      - link "Sign up now" [ref=e54] [cursor=pointer]:
        - /url: /register
```

# Test source

```ts
  7   |  *  - Login + role selection modal handling
  8   |  *  - Logout (clear localStorage + sessionStorage)
  9   |  *  - Wallet-balance capture (does not assert — read-only)
  10  |  *  - PdfViewer canvas-render wait
  11  |  *
  12  |  * NEVER prints password / token values. Env credentials are passed in via the
  13  |  * spec; this file does not call `process.env.X` at evaluation time so the helper
  14  |  * stays portable across CI configs.
  15  |  */
  16  | 
  17  | import type { Page } from '@playwright/test';
  18  | import * as fs from 'fs';
  19  | import * as os from 'os';
  20  | import * as path from 'path';
  21  | import { fileURLToPath } from 'url';
  22  | 
  23  | // ESM equivalent of `__dirname` for the helpers/ subdirectory.
  24  | const __filename = fileURLToPath(import.meta.url);
  25  | const __dirname = path.dirname(__filename);
  26  | 
  27  | /**
  28  |  * The Researcher/Reviewer accounts are NOT seeded in production. The FE uses
  29  |  * `input[name="username"]` for the email field (see Login.tsx) and the BE
  30  |  * wires the email via `auth.service.ts` `login({ email, password })`. So we
  31  |  * fill `input[name="username"]` with the email.
  32  |  */
  33  | export const USERNAME_INPUT = 'input[name="username"], input[name="email"]';
  34  | export const PASSWORD_INPUT = 'input[name="password"], input[type="password"]';
  35  | export const SIGN_IN_BUTTON = 'button[type="submit"]:has-text("Sign in")';
  36  | 
  37  | export interface PdfFixture {
  38  |   /** Absolute path to a copy of the PDF on disk (Playwright `setInputFiles`). */
  39  |   tmpPath: string;
  40  |   /** Human-readable filename, including `.pdf` extension. */
  41  |   fileName: string;
  42  | }
  43  | 
  44  | export function makeUniquePaperTitle(): string {
  45  |   return `ARS-E2E Main Review Flow ${new Date()
  46  |     .toISOString()
  47  |     .replace(/[:.]/g, '-')}`;
  48  | }
  49  | 
  50  | /**
  51  |  * Reads the FIRST `*.pdf` from `src/tests/fixtures/` (already used by other
  52  |  * E2E files — researcherUpload.e2e.test.ts uses `getRandomPdfFile()` from
  53  |  * `src/assets/pdf_sample/` but those files are academic arXiv copies and too
  54  |  * heavy; the fixture dir holds 3 small PDFs totaling ~8 KB which is plenty
  55  |  * for an intercepted Playwright session).
  56  |  *
  57  |  * Copies the fixture into a deterministic tmp path so Playwright can attach
  58  |  * it to a hidden file input. Returns both `tmpPath` (absolute, ephemeral)
  59  |  * and `fileName` (the original name, suitable for `setInputFiles`).
  60  |  */
  61  | export function pickSafePdfFixture(): PdfFixture {
  62  |   // helpers/ → e2e/ → tests/ → fixtures/
  63  |   const fixtureDir = path.resolve(
  64  |     __dirname,
  65  |     '..',
  66  |     '..',
  67  |     'fixtures',
  68  |   );
  69  |   if (!fs.existsSync(fixtureDir)) {
  70  |     throw new Error(
  71  |       `[researcherReviewerFlow] fixtures directory missing: ${fixtureDir}`,
  72  |     );
  73  |   }
  74  |   const pdfs = fs
  75  |     .readdirSync(fixtureDir)
  76  |     .filter((f) => f.toLowerCase().endsWith('.pdf'));
  77  |   if (pdfs.length === 0) {
  78  |     throw new Error(
  79  |       `[researcherReviewerFlow] no PDF fixtures found in ${fixtureDir}`,
  80  |     );
  81  |   }
  82  |   // Deterministic: take the smallest fixture so the upload is fast.
  83  |   const sorted = pdfs
  84  |     .map((f) => ({ f, size: fs.statSync(path.join(fixtureDir, f)).size }))
  85  |     .sort((a, b) => a.size - b.size);
  86  |   const chosen = sorted[0]!.f;
  87  |   const src = path.join(fixtureDir, chosen);
  88  |   const tmpDir = fs.mkdtempSync(
  89  |     path.join(os.tmpdir(), 'ars-revrev-'),
  90  |   );
  91  |   const tmpPath = path.join(tmpDir, chosen);
  92  |   fs.copyFileSync(src, tmpPath);
  93  |   return { tmpPath, fileName: chosen };
  94  | }
  95  | 
  96  | /**
  97  |  * Submits the login form and, if a multi-role selection modal appears, picks
  98  |  * the requested role. Reads `localStorage.ars_user` afterwards to confirm the
  99  |  * active role was persisted.
  100 |  */
  101 | export async function signInAs(
  102 |   page: Page,
  103 |   email: string,
  104 |   password: string,
  105 |   expectedRole: string,
  106 | ): Promise<void> {
> 107 |   await page.goto('/login', { waitUntil: 'networkidle', timeout: 45_000 });
      |              ^ TimeoutError: page.goto: Timeout 45000ms exceeded.
  108 |   // Wait for the Login form to render. The custom <Input> component renders a
  109 |   // native <input> with `name="username"`; the Fast Login buttons also exist
  110 |   // even before any data is loaded. Either of these arriving means the React
  111 |   // tree is mounted.
  112 |   await page.waitForSelector(
  113 |     'input[name="username"], input[name="email"], button:has-text("Sign in")',
  114 |     { timeout: 45_000 },
  115 |   );
  116 |   await page.fill(USERNAME_INPUT, email);
  117 |   await page.fill(PASSWORD_INPUT, password);
  118 |   await Promise.all([
  119 |     page
  120 |       .waitForURL((u) => !/\/login\b/.test(u.pathname), { timeout: 25_000 })
  121 |       .catch(() => undefined),
  122 |     page.click(SIGN_IN_BUTTON),
  123 |   ]);
  124 | 
  125 |   // Multi-role modal: click the radio matching `expectedRole` then "Continue"
  126 |   const modalTitle = page.locator(
  127 |     '[role="dialog"][aria-labelledby="role-selection-title"]',
  128 |   );
  129 |   const modalOpen = await modalTitle.isVisible().catch(() => false);
  130 |   if (modalOpen) {
  131 |     const radio = modalTitle
  132 |       .locator(`input[type="radio"][value="${expectedRole}"]`)
  133 |       .first();
  134 |     if (await radio.isVisible().catch(() => false)) {
  135 |       await radio.check().catch(() => undefined);
  136 |     }
  137 |     const continueBtn = modalTitle.locator(
  138 |       `button:has-text("Continue as")`,
  139 |     );
  140 |     await continueBtn.click({ timeout: 5_000 }).catch(() => undefined);
  141 |     // Wait for the modal to disappear before continuing.
  142 |     await modalTitle.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  143 |   }
  144 | 
  145 |   // Verify the user record in localStorage reflects the role. If the user was
  146 |   // already single-role Researcher/Reviewer, `ars_user` is set; if the modal
  147 |   // was needed, it was set on continue. If neither happened, throw — the test
  148 |   // body needs a confirmed auth state.
  149 |   await page.waitForFunction(
  150 |     (role: string) => {
  151 |       try {
  152 |         const raw = localStorage.getItem('ars_user');
  153 |         if (!raw) return false;
  154 |         const parsed = JSON.parse(raw) as { roleName?: string };
  155 |         return parsed.roleName === role;
  156 |       } catch {
  157 |         return false;
  158 |       }
  159 |     },
  160 |     expectedRole,
  161 |     { timeout: 10_000 },
  162 |   );
  163 | }
  164 | 
  165 | /**
  166 |  * Clears both localStorage and sessionStorage of any `ars_*` keys, then visits
  167 |  * `/login`. We do NOT call `authService.logout()` from JS because Playwright
  168 |  * already has direct DOM access — clearing the persisted buckets is enough to
  169 |  * drop auth state and bounce the route guard.
  170 |  */
  171 | export async function signOut(page: Page): Promise<void> {
  172 |   await page.evaluate(() => {
  173 |     try {
  174 |       const lsKeys = Object.keys(localStorage).filter((k) =>
  175 |         k.startsWith('ars_'),
  176 |       );
  177 |       lsKeys.forEach((k) => localStorage.removeItem(k));
  178 |       const ssKeys = Object.keys(sessionStorage).filter((k) =>
  179 |         k.startsWith('ars_'),
  180 |       );
  181 |       ssKeys.forEach((k) => sessionStorage.removeItem(k));
  182 |     } catch {
  183 |       /* ignore */
  184 |     }
  185 |   });
  186 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  187 | }
  188 | 
  189 | /**
  190 |  * Captures whatever wallet balance the UI is showing. This is a passive read —
  191 |  * the test never asserts on it because the 25,000 VND system fee is OUT OF
  192 |  * SCOPE per the user-confirmed financial-safety override. We still surface the
  193 |  * value to the test log for forensics.
  194 |  */
  195 | export async function recordWalletBeforeSubmit(
  196 |   page: Page,
  197 | ): Promise<{ raw: string | null }> {
  198 |   const bodyText = await page.textContent('body').catch(() => '');
  199 |   const match = bodyText?.match(/([\d.,]+)\s*VND/);
  200 |   return { raw: match ? match[0] : null };
  201 | }
  202 | 
  203 | /**
  204 |  * Waits for the PdfViewer `<canvas>` to render with non-zero dimensions. The
  205 |  * `data-testid="pdf-canvas"` selector is set by `PdfViewer.tsx`. The check
  206 |  * avoids a race where Playwright sees the canvas in the DOM before the first
  207 |  * `page.render()` call finishes.
```