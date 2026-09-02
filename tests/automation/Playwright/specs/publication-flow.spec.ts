/**
 * Publication Flow E2E — Researcher → Admin → Reviewer → Admin → Public View
 *
 * Single sequential test that walks through the full publication lifecycle
 * with proper field selectors matching the actual form structure.
 *
 * Screenshot path: F:\CAPSTONE_PROJECT\ARS_FE\test\report\pub-flow-screenshots\
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { ROUTES } from '../../../../src/routes/paths';
import { getCredentials } from '../helpers/credentials';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'report', 'pub-flow-screenshots');
const PDF_PATH = path.join(REPO_ROOT, 'test', 'report', 'pub-flow-test-paper.pdf');

const RUN_PREFIX = process.env.PW_TEST_RUN_PREFIX ?? `ARS-E2E-PUB-FLOW-${Date.now()}`;
const PAPER_TITLE = `${RUN_PREFIX} - Quantum Computing Advances`;
const PAPER_ABSTRACT = `This paper explores recent advances in quantum computing algorithms and their applications in cryptography, optimization problems, and machine learning. We present novel approaches to error correction and demonstrate significant speedups over classical methods on benchmark datasets.`;
const AUTHOR_NAME = 'Jane Smith';
const INSTITUTION = 'FPT University';
const KEYWORDS = 'quantum computing, cryptography, algorithms';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loginViaApi(page: Page, role: 'admin' | 'researcher' | 'reviewer'): Promise<void> {
  const creds = getCredentials(role);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(creds.email);
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  await passwordInput.fill(creds.password);
  await passwordInput.press('Enter');
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/login') && !url.pathname.startsWith('/forgot-password'),
    { timeout: 30_000 },
  ).catch(() => {});
}

async function logoutViaStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch { /* storage may be unavailable */ }
  });
}

async function fillResearcherForm(page: Page): Promise<void> {
  // Fill title
  const titleInput = page.locator('#submission-title');
  await titleInput.waitFor({ state: 'visible', timeout: 10_000 });
  await titleInput.fill(PAPER_TITLE);
  console.log(`  ✓ Title: ${PAPER_TITLE}`);

  // Fill abstract
  const abstractInput = page.locator('#submission-abstract');
  await abstractInput.fill(PAPER_ABSTRACT);
  console.log('  ✓ Abstract');

  // Fill author
  await page.locator('#submission-author').fill(AUTHOR_NAME);
  console.log(`  ✓ Author: ${AUTHOR_NAME}`);

  // Fill institution
  await page.locator('#submission-institution').fill(INSTITUTION);
  console.log(`  ✓ Institution: ${INSTITUTION}`);

  // Fill keywords
  await page.locator('#submission-keywords').fill(KEYWORDS);
  console.log(`  ✓ Keywords: ${KEYWORDS}`);

  // Wait for major fields to load
  await sleep(2_000);
  const majorFieldSelect = page.locator('#submission-major-field');
  await majorFieldSelect.waitFor({ state: 'visible' });

  // Get the option values
  const majorOptionCount = await majorFieldSelect.locator('option').count();
  console.log(`  Major field options: ${majorOptionCount}`);
  if (majorOptionCount > 1) {
    // Pick the first non-empty option (skip the placeholder)
    const majorOptions = await majorFieldSelect.locator('option').all();
    let picked = false;
    for (const opt of majorOptions) {
      const value = await opt.getAttribute('value');
      if (value && value !== '' && value !== '0') {
        await majorFieldSelect.selectOption(value);
        const label = await opt.textContent();
        console.log(`  ✓ Major field: ${label} (id=${value})`);
        picked = true;
        break;
      }
    }
    if (!picked) {
      // Pick any non-empty
      const opt = majorOptions[1];
      const value = await opt.getAttribute('value');
      if (value) {
        await majorFieldSelect.selectOption(value);
        const label = await opt.textContent();
        console.log(`  ✓ Major field: ${label} (id=${value})`);
      }
    }
  }

  // Wait for subfields to load (depends on major field selection)
  await sleep(2_000);

  const subFieldSelect = page.locator('#submission-subfield');
  const subOptionCount = await subFieldSelect.locator('option').count();
  console.log(`  Subfield options: ${subOptionCount}`);
  if (subOptionCount > 1) {
    const subOptions = await subFieldSelect.locator('option').all();
    for (const opt of subOptions) {
      const value = await opt.getAttribute('value');
      if (value && value !== '' && value !== '0') {
        await subFieldSelect.selectOption(value);
        const label = await opt.textContent();
        console.log(`  ✓ Subfield: ${label} (id=${value})`);
        break;
      }
    }
  }
}

async function uploadPdf(page: Page): Promise<boolean> {
  const fileInput = page.locator('#submission-file, input[type="file"]').first();
  if (await fileInput.count() === 0) return false;
  await fileInput.setInputFiles(PDF_PATH);
  console.log('  ✓ PDF file selected');
  // Wait for upload to complete
  await sleep(10_000);
  // Look for the URL display
  const urlDisplay = page.locator('[data-testid="submission-file-url"]');
  if (await urlDisplay.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const url = await urlDisplay.textContent();
    console.log(`  ✓ PDF uploaded, URL: ${url?.slice(0, 80)}...`);
    return true;
  }
  return false;
}

// ─── MAIN TEST ───────────────────────────────────────────────────────────────

test('Full publication flow: Researcher → Admin → Reviewer → Admin → Public', async ({ browser }) => {
  const results: Record<string, string> = {};
  const evidence: string[] = [];

  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();

  try {
    // ═══ STEP 1: Researcher submission ═══
    console.log('\n═══ STEP 1: Researcher submission ═══');
    await loginViaApi(page, 'researcher');
    await page.goto(ROUTES.RESEARCHER_SUBMISSION_NEW, { waitUntil: 'domcontentloaded' });
    await sleep(2_000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01a-researcher-form.png') });
    evidence.push('01a-researcher-form.png');

    await fillResearcherForm(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01b-researcher-form-filled.png') });
    evidence.push('01b-researcher-form-filled.png');

    const pdfUploaded = await uploadPdf(page);
    results.pdfUploaded = pdfUploaded ? 'yes' : 'no';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01c-researcher-pdf-uploaded.png') });
    evidence.push('01c-researcher-pdf-uploaded.png');

    // Check if submit is now enabled
    const submitBtn = page.locator('[data-testid="submission-submit"]').first();
    const submitEnabled = await submitBtn.isEnabled().catch(() => false);
    results.submitEnabled = submitEnabled ? 'yes' : 'no';
    console.log(`  Submit button enabled: ${submitEnabled}`);

    if (submitEnabled) {
      await submitBtn.click();
      await sleep(5_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01d-after-submit.png') });
      evidence.push('01d-after-submit.png');
      results.step1 = 'submitted';
    } else {
      console.log('  ⚠ Submit still disabled');
      results.step1 = 'submit-disabled';
      // Try to figure out what's missing
      const validationMsg = page.locator('[role="status"]').first();
      const msg = await validationMsg.textContent().catch(() => '');
      results.validationMessage = msg ?? 'no message';
      console.log(`  Validation msg: ${msg}`);
    }

    // Navigate to submissions list to confirm paper exists
    await page.goto(ROUTES.RESEARCHER_SUBMISSIONS, { waitUntil: 'domcontentloaded' });
    await sleep(3_000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01e-submissions-list.png'), fullPage: true });
    evidence.push('01e-submissions-list.png');

    // ═══ STEP 2: Admin locates paper ═══
    console.log('\n═══ STEP 2: Admin locates paper ═══');
    await logoutViaStorage(page);
    await loginViaApi(page, 'admin');
    await page.goto(ROUTES.ADMIN_PAPER_SUBMISSIONS, { waitUntil: 'domcontentloaded' });
    await sleep(3_000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02a-admin-paper-submissions.png'), fullPage: true });
    evidence.push('02a-admin-paper-submissions.png');

    // Look for the paper in the list — the paper row contains our title
    const adminPaperItem = page.locator(`tr:has-text("${PAPER_TITLE}")`).first();
    const adminFound = await adminPaperItem.isVisible({ timeout: 15_000 }).catch(() => false);
    results.adminFoundPaper = adminFound ? 'yes' : 'no';
    console.log(`  Admin sees the paper: ${adminFound}`);

    if (adminFound) {
      // Click "Open editorial record" link within the row
      const openLink = adminPaperItem.locator('a:has-text("Open editorial record")');
      const openLinkVisible = await openLink.isVisible({ timeout: 3_000 }).catch(() => false);
      if (openLinkVisible) {
        await openLink.click();
      } else {
        await adminPaperItem.click();
      }
      await sleep(4_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02b-admin-paper-detail.png'), fullPage: true });
      evidence.push('02b-admin-paper-detail.png');

      // Capture paper ID from URL
      const detailUrl = page.url();
      console.log(`  Detail URL: ${detailUrl}`);
      const paperIdMatch = detailUrl.match(/\/(\d+)/);
      const paperId = paperIdMatch?.[1] ?? null;
      results.paperId = paperId ?? 'not-detected';

      // Capture page text to identify status / actions available
      const bodyText = (await page.locator('body').textContent()) ?? '';
      const statusMatch = bodyText.match(/(SUBMITTED|DRAFT|UNDER_REVIEW|REVIEWER_ASSIGNED|REVIEWER_RECOMMENDED_ACCEPT|REVIEWER_RECOMMENDED_REJECT|READY_FOR_REVIEWER|PUBLISHED|ADMIN_SCREENING|Submitted|Draft|Published|Under Review|Reviewer Assigned|Admin Screening|Ready for Reviewer|Approved|Rejected)/i);
      results.paperStatus = statusMatch?.[1] ?? 'unknown';
      console.log(`  Paper status (from text): ${results.paperStatus}`);

      // Look for assign reviewer section
      const hasAssignBtn = await page.locator('button:has-text("Assign"), button:has-text("Phân công")').first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasAutoBtn = await page.locator('button:has-text("Auto"), button:has-text("Tự động")').first().isVisible({ timeout: 2_000 }).catch(() => false);
      results.hasAssignBtn = hasAssignBtn ? 'yes' : 'no';
      results.hasAutoBtn = hasAutoBtn ? 'yes' : 'no';

      // First, accept authorship verification (REQUIRED before reviewer assignment is unlocked)
      console.log('\n═══ STEP 3a: Admin verifies authorship ═══');
      const verifyBtn = page.locator('button:has-text("Chấp nhận tác quyền"), button:has-text("Accept & Allow Verification"), button:has-text("Accept authorship")').first();
      const hasVerifyBtn = await verifyBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      results.hasVerifyBtn = hasVerifyBtn ? 'yes' : 'no';
      console.log(`  Verify authorship button visible: ${hasVerifyBtn}`);
      if (hasVerifyBtn) {
        await verifyBtn.click();
        await sleep(3_000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03a-after-verify.png') });
        evidence.push('03a-after-verify.png');
        results.verifyAction = 'attempted';
      }

      // Check ReviewRequest list
      const reviewRequests = await page.evaluate(async (pId) => {
        try {
          const res = await fetch('/api/ReviewRequest', { credentials: 'include' });
          if (!res.ok) return { error: `status ${res.status}` };
          const all = await res.json();
          return all
            .filter((r: any) => String(r.paperId) === String(pId))
            .map((r: any) => ({
              id: r.reviewRequestId ?? r.id,
              reviewerId: r.reviewerId,
              reviewerName: r.reviewerName,
              status: r.status,
            }));
        } catch (e) {
          return { error: String(e) };
        }
      }, paperId);
      results.reviewRequestsForPaper = JSON.stringify(reviewRequests);
      console.log(`  ReviewRequests for paper: ${JSON.stringify(reviewRequests)}`);

      // ═══ STEP 3b: Auto-assign or manual assign (now unlocked) ═══
      console.log('\n═══ STEP 3b: Assign reviewer (after verification) ═══');
      // Refresh button detection after verification
      const assignBtnAfter = page.locator('button:has-text("Assign"), button:has-text("Phân công")').filter({ hasNotText: 'Allow' });
      const autoBtnAfter = page.locator('button:has-text("Auto"), button:has-text("Tự động")');
      const hasAutoBtnNow = await autoBtnAfter.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasAssignBtnNow = await assignBtnAfter.first().isVisible({ timeout: 3_000 }).catch(() => false);
      console.log(`  Auto-assign visible after verify: ${hasAutoBtnNow}, Manual assign visible: ${hasAssignBtnNow}`);
      if (hasAutoBtnNow) {
        const autoBtn = page.locator('button:has-text("Auto"), button:has-text("Tự động")').first();
        await autoBtn.click();
        await sleep(4_000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03b-after-auto-assign.png') });
        evidence.push('03b-after-auto-assign.png');
        results.autoAssignAction = 'attempted';
      } else if (hasAssignBtnNow) {
        // Try manual assign: enter reviewer ID
        // First, try to get the reviewer's user ID via multiple API endpoints
        const reviewerInfo = await page.evaluate(async () => {
          // Try users endpoint
          try {
            const res1 = await fetch('/api/user', { credentials: 'include' });
            if (res1.ok) {
              const users = await res1.json();
              const u = users.find((x: any) => x.email === 'reviewer@arsplatform.com');
              if (u) return { id: u.id ?? u.userId, source: 'users' };
            }
          } catch {}

          // Try professional profiles
          try {
            const res2 = await fetch('/api/ProfessionalProfile', { credentials: 'include' });
            if (res2.ok) {
              const profiles = await res2.json();
              // Find any profile with reviewer in the name or email
              const rp = profiles.find((p: any) =>
                (p.reviewerEmail || p.email || '').toLowerCase().includes('reviewer'));
              if (rp) return { id: rp.reviewerId ?? rp.userId ?? rp.id, source: 'profiles' };
            }
          } catch {}

          // Return null if nothing found
          return null;
        });

        console.log(`  Reviewer info: ${JSON.stringify(reviewerInfo)}`);
        results.reviewerUserInfo = JSON.stringify(reviewerInfo);

        // Try to directly create a review request
        const createRR = await page.evaluate(async (pId, rId) => {
          try {
            const res = await fetch('/api/ReviewRequest', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paperId: Number(pId),
                reviewerId: Number(rId) || 152,
                status: 'Pending',
                deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
                type: 'Editorial',
              }),
            });
            return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) };
          } catch (e) {
            return { error: String(e) };
          }
        }, paperId, reviewerInfo?.id ?? 152);
        console.log(`  Create ReviewRequest result: ${JSON.stringify(createRR)}`);
        results.createReviewRequestResult = JSON.stringify(createRR);

        // If reviewer ID found, try UI-based assignment
        const rId = reviewerInfo?.id ?? 152;
        if (rId) {
          const reviewerIdInput = page.locator('input[id*="reviewer" i], input[name*="reviewer" i], input[type="number"]').first();
          if (await reviewerIdInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await reviewerIdInput.fill(String(rId));
            const assignBtn = page.locator('button:has-text("Assign"), button:has-text("Phân công"), button:has-text("Gáni")').first();
            if (await assignBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await assignBtn.click();
              await sleep(4_000);
              await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03c-after-manual-assign.png') });
              evidence.push('03c-after-manual-assign.png');
              results.manualAssignAction = 'attempted';
            }
          }
        }
      } else {
        // Take screenshot of what we have now to understand the state
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-no-assign-buttons.png'), fullPage: true });
        evidence.push('03-no-assign-buttons.png');
        results.assignButtonsAfterVerify = 'none';
      }

      // Re-check review requests after assignment attempt
      await sleep(2_000);
      const reviewRequestsAfter = await page.evaluate(async (pId) => {
        try {
          const res = await fetch('/api/ReviewRequest', { credentials: 'include' });
          if (!res.ok) return [];
          const all = await res.json();
          return all
            .filter((r: any) => String(r.paperId) === String(pId))
            .map((r: any) => ({
              id: r.reviewRequestId ?? r.id,
              reviewerId: r.reviewerId,
              reviewerName: r.reviewerName,
              reviewerEmail: r.reviewerEmail,
              status: r.status,
              deadline: r.deadline,
              type: r.type,
              aiRecommended: r.aiRecommended,
              subFieldId: r.subFieldId,
              fieldId: r.fieldId,
            }));
        } catch { return []; }
      }, paperId);
      results.reviewRequestsAfterAssign = JSON.stringify(reviewRequestsAfter);
      console.log(`  ReviewRequests after assign: ${JSON.stringify(reviewRequestsAfter)}`);

      // Get reviewer details to verify subject match
      if (reviewRequestsAfter.length > 0) {
        const rr = reviewRequestsAfter[0];
        const reviewerDetails = await page.evaluate(async (rid) => {
          try {
            const res = await fetch(`/api/user/${rid}`, { credentials: 'include' });
            if (!res.ok) return { status: res.status };
            return await res.json();
          } catch (e) {
            return { error: String(e) };
          }
        }, rr.reviewerId);
        results.reviewerDetails = JSON.stringify(reviewerDetails);
        console.log(`  Reviewer details: ${JSON.stringify(reviewerDetails)}`);

        // Try to get reviewer's professional profile for subject info
        const reviewerProfile = await page.evaluate(async (rid) => {
          try {
            const res = await fetch('/api/ProfessionalProfile', { credentials: 'include' });
            if (!res.ok) return { status: res.status };
            const profiles = await res.json();
            return profiles.filter((p: any) => p.userId === rid || p.reviewerId === rid);
          } catch { return null; }
        }, rr.reviewerId);
        results.reviewerProfile = JSON.stringify(reviewerProfile);
        console.log(`  Reviewer profile: ${JSON.stringify(reviewerProfile)}`);
      }

      // Refresh the page to see updated state
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(3_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03c-admin-after-assign-refresh.png'), fullPage: true });
      evidence.push('03c-admin-after-assign-refresh.png');
    }

    // ═══ STEP 4: Reviewer reviews the paper ═══
    console.log('\n═══ STEP 4: Reviewer reviews ═══');
    await logoutViaStorage(page);
    await loginViaApi(page, 'reviewer');
    await page.goto(ROUTES.REVIEWER_ASSIGNMENTS, { waitUntil: 'domcontentloaded' });
    await sleep(3_000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04a-reviewer-assignments.png'), fullPage: true });
    evidence.push('04a-reviewer-assignments.png');

    const reviewerSeesPaper = await page.locator(`text="${PAPER_TITLE}"`).first().isVisible({ timeout: 15_000 }).catch(() => false);
    results.reviewerSeesPaper = reviewerSeesPaper ? 'yes' : 'no';
    console.log(`  Reviewer sees the paper: ${reviewerSeesPaper}`);

    if (reviewerSeesPaper) {
      await page.locator(`text="${PAPER_TITLE}"`).first().click();
      await sleep(4_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b-reviewer-detail.png'), fullPage: true });
      evidence.push('04b-reviewer-detail.png');

      // Accept the assignment
      const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Nhận")').first();
      if (await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await acceptBtn.click();
        await sleep(3_000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04c-reviewer-accepted.png') });
        evidence.push('04c-reviewer-accepted.png');
        results.reviewerAccepted = 'yes';
      }

      // Fill in evaluation
      const scoreInputs = page.locator('input[type="range"], input[type="number"]');
      const scoreCount = await scoreInputs.count();
      console.log(`  Score inputs found: ${scoreCount}`);
      for (let i = 0; i < Math.min(scoreCount, 5); i++) {
        const input = scoreInputs.nth(i);
        if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await input.fill('4');
        }
      }

      // Pick Accept recommendation
      const acceptRec = page.locator('input[type="radio"][value*="ACCEPT" i], button:has-text("Accept"), label:has-text("Accept")').first();
      if (await acceptRec.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await acceptRec.click();
      }

      // Fill any comments
      const commentsArea = page.locator('textarea[name*="comment" i], textarea[placeholder*="comment" i], textarea[id*="comment" i]').first();
      if (await commentsArea.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await commentsArea.fill('Recommended for publication. Solid methodology and clear results.');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04d-reviewer-form-filled.png'), fullPage: true });
      evidence.push('04d-reviewer-form-filled.png');

      // Submit the review
      const submitEval = page.locator('button:has-text("Submit Review"), button:has-text("Submit"), button:has-text("Đánh giá"), button[type="submit"]').last();
      if (await submitEval.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitEval.click();
        await sleep(5_000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04e-reviewer-submitted.png'), fullPage: true });
        evidence.push('04e-reviewer-submitted.png');
        results.reviewerSubmitted = 'yes';
      } else {
        results.reviewerSubmitted = 'no-submit-button';
      }
    }

    // ═══ STEP 5: Admin publishes ═══
    console.log('\n═══ STEP 5: Admin publishes ═══');
    await logoutViaStorage(page);
    await loginViaApi(page, 'admin');
    await page.goto(ROUTES.ADMIN_PAPER_SUBMISSIONS, { waitUntil: 'domcontentloaded' });
    await sleep(3_000);

    const adminPaperAgain = page.locator(`tr:has-text("${PAPER_TITLE}")`).first();
    const adminFoundAgain = await adminPaperAgain.isVisible({ timeout: 15_000 }).catch(() => false);
    if (adminFoundAgain) {
      // Click "Open editorial record" link within the row
      const openLinkAgain = adminPaperAgain.locator('a:has-text("Open editorial record")');
      if (await openLinkAgain.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await openLinkAgain.click();
      } else {
        await adminPaperAgain.click();
      }
      await sleep(3_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05a-admin-detail-after-review.png'), fullPage: true });
      evidence.push('05a-admin-detail-after-review.png');

      const publishBtn = page.locator('button:has-text("Publish"), button:has-text("Approve and publish"), button:has-text("Xuất bản")').first();
      const hasPublish = await publishBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      results.hasPublishBtn = hasPublish ? 'yes' : 'no';
      console.log(`  Publish button visible: ${hasPublish}`);

      if (hasPublish) {
        await publishBtn.click();
        await sleep(5_000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05b-admin-published.png'), fullPage: true });
        evidence.push('05b-admin-published.png');
        results.adminPublished = 'yes';
      }
    }

    // ═══ STEP 6: Verify public catalog ═══
    console.log('\n═══ STEP 6: Public catalog verification ═══');
    await logoutViaStorage(page);
    await page.goto(ROUTES.PAPERS, { waitUntil: 'domcontentloaded' });
    await sleep(4_000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06a-public-catalog.png'), fullPage: true });
    evidence.push('06a-public-catalog.png');

    // Try search
    const catalogSearch = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await catalogSearch.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await catalogSearch.fill(PAPER_TITLE);
      await sleep(2_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06b-public-search.png'), fullPage: true });
      evidence.push('06b-public-search.png');
    }

    const publicPaper = page.locator(`text="${PAPER_TITLE}"`).first();
    const publicFound = await publicPaper.isVisible({ timeout: 15_000 }).catch(() => false);
    results.publicCatalogFound = publicFound ? 'yes' : 'no';
    console.log(`  Public catalog shows paper: ${publicFound}`);

    if (publicFound) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06c-public-found.png'), fullPage: true });
      evidence.push('06c-public-found.png');
    } else {
      // Try HOME page
      await page.goto(ROUTES.HOME, { waitUntil: 'domcontentloaded' });
      await sleep(3_000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06d-public-home.png'), fullPage: true });
      evidence.push('06d-public-home.png');

      const publicOnHome = await page.locator(`text="${PAPER_TITLE}"`).first().isVisible({ timeout: 10_000 }).catch(() => false);
      results.publicFoundOnHome = publicOnHome ? 'yes' : 'no';
      console.log(`  Paper appears on /home: ${publicOnHome}`);
    }
  } catch (err) {
    console.error('TEST ERROR:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-error.png') }).catch(() => {});
    evidence.push('99-error.png');
    throw err;
  } finally {
    await context.close();
  }

  // Write results.json
  const reportData = {
    timestamp: new Date().toISOString(),
    paperTitle: PAPER_TITLE,
    results,
    evidence,
  };
  console.log('\n═══ RESULTS ═══');
  console.log(JSON.stringify(reportData, null, 2));
  const fs = await import('node:fs');
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'results.json'),
    JSON.stringify(reportData, null, 2),
  );
});