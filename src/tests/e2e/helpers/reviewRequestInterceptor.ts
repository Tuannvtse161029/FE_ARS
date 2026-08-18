/**
 * Researcher → Reviewer request-flow network interceptor.
 *
 * Installs `page.route(...)` handlers that synthesize the BE responses the FE
 * expects during the journey:
 *
 *   POST /api/ReviewRequest           → synthesized { id, status: 'Pending', fee, paperId, reviewerId }
 *   GET  /api/ProfessionalProfile     → seeded reviewer list with one `reviewFee: 0`
 *   POST /api/DetailedEvaluation      → synthesized evaluation id
 *   PUT  /api/ReviewRequest/{id}      → echoes status transition (Pending → Completed)
 *   PUT  /api/Paper/{id}              → echoes paper status update
 *
 * IMPORTANT — intercepted mode is NOT a substitute for live BE verification.
 * It is ONLY used so the FE flow can complete when the Researcher test wallet
 * cannot cover the 25,000 VND system processing fee and the BE cannot accept
 * the request. We do NOT alter `localStorage` to fake funds, do NOT open
 * PayOS, and do NOT bypass real authentication.
 *
 * Callers pass a single `scenario` object — the interceptor mutates shared
 * ids in-place so subsequent phases see consistent state.
 */

import type { Page } from '@playwright/test';

export interface FlowScenario {
  /** Synthesized paper id; populated by the paper-create interception. */
  paperId: number;
  /** Synthesized reviewer user id (always paired with `reviewFee: 0`). */
  reviewerId: number;
  /** Synthesized review request id; populated by the ReviewRequest interception. */
  reviewRequestId: number;
  /** Synthesized detailed evaluation id; populated after evaluation submission. */
  evaluationId: number;
  /** Single seeded fee-zero reviewer; matched by DiscoverReviewers. */
  zeroFeeReviewer: {
    userId: number;
    fullName: string;
    title: string;
    orcidId: string;
    hindex: number;
    publicationCount: number;
    reviews: number;
    reviewFee: number;
    isAvailable: boolean;
  };
}

export function makeScenario(): FlowScenario {
  return {
    paperId: 1_000_001,
    reviewerId: 9_001,
    reviewRequestId: 1_000_002,
    evaluationId: 1_000_003,
    zeroFeeReviewer: {
      userId: 9_001,
      fullName: 'Dr. Fee Zero (E2E Seeded)',
      title: 'Independent Reviewer',
      orcidId: '0000-0000-0000-0000',
      hindex: 12,
      publicationCount: 18,
      reviews: 7,
      reviewFee: 0,
      isAvailable: true,
    },
  };
}

// External handler so callers can introspect what was hit and what was returned.
  // Useful in CI when timing logs are interleaved.

  export function installReviewRequestRoutes(
    page: Page,
    scenario: FlowScenario,
  ): void {
    // Lightweight response logging so CI logs show what was hit.
    page.on('response', (resp) => {
      const u = resp.url();
      if (u.includes('/ProfessionalProfile') || u.includes('/ReviewRequest')) {
        console.log(`[E2E.Network] ${resp.status()} ${resp.request().method()} ${u}`);
      }
    });

    // ── Paper — single combined handler for create / get-all / get-by-id.
    // Order matters: Playwright evaluates the FIRST matching handler. We use a
    // single regex so every /api/paper* URL is captured here regardless of
    // method.
    page.route(/\/api\/paper(\/.*)?(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      let body: { title?: string } = {};
      try {
        body = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: String(scenario.paperId),
          title: body.title ?? 'Untitled',
          status: 'Waiting for Review',
          fileUrl:
            'https://firebasestorage.googleapis.com/v0/b/ars-platform-fe.appspot.com/o/papers%2Fe2e-test.pdf?alt=media&token=e2e',
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: String(scenario.paperId),
              title: 'E2E Main Review Flow Paper',
              status: 'Waiting for Review',
              fileUrl:
                'https://firebasestorage.googleapis.com/v0/b/ars-platform-fe.appspot.com/o/papers%2Fe2e-test.pdf?alt=media&token=e2e',
              createdAt: new Date().toISOString(),
            },
          ],
          totalCount: 1,
        }),
      });
      return;
    }
    return route.continue();
  });

  // ── ProfessionalProfile — seeded reviewer list, one with reviewFee: 0.
  page.route(/\/api\/ProfessionalProfile(\/.*)?(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      const seededReviewer = {
        userId: scenario.reviewerId,
        orcidId: '0000-0000-0000-0000',
        hindex: 12,
        totalCitations: 120,
        publicationCount: 18,
        syncStatus: 'synced',
        reviewFee: 0,
        isAvailable: true,
        updatedAt: new Date().toISOString(),
        // Enriched fields used by DiscoverReviewers (extends ReviewerProfile).
        fullName: 'Dr. Fee Zero (E2E Seeded)',
        title: 'Independent Reviewer',
        avatarBg: '#3b82f6',
        reviews: 7,
        tags: ['AI', 'NLP'],
        specializations: ['Machine Learning'],
      };
      console.log('[E2E Intercept] ProfessionalProfile GET → 1 seeded reviewer');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify([seededReviewer]),
      });
      return;
    }
    return route.continue();
  });

  // ── Wallet — return a small non-zero balance so the DiscoverReviewers UI
  //    doesn't trip the "Add Fund to Wallet" branch. The balance is arbitrary
  //    — we never assert against it (financial-safety override).
  page.route(/\/api\/Wallet(\/.*)?(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      console.log('[E2E Intercept] Wallet GET → 1 wallet with balance');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            walletId: 1,
            userId: 2,
            balance: 1_500_000,
            lockedFunds: 0,
            createdAt: new Date().toISOString(),
          },
        ]),
      });
      return;
    }
    return route.continue();
  });

  // ── ReviewRequest — single combined handler for GET / POST / PUT.
  page.route(/\/api\/ReviewRequest(\/.*)?(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      let body: { paperId?: number; reviewerId?: number; fee?: number } = {};
      try {
        body = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reviewRequestId: scenario.reviewRequestId,
          id: scenario.reviewRequestId,
          paperId: body.paperId ?? scenario.paperId,
          reviewerId: body.reviewerId ?? scenario.reviewerId,
          fee: body.fee ?? 25000,
          status: 'Pending',
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            reviewRequestId: scenario.reviewRequestId,
            id: scenario.reviewRequestId,
            paperId: scenario.paperId,
            reviewerId: scenario.reviewerId,
            fee: 25000,
            status: 'Pending',
            paperTitle: 'E2E Main Review Flow Paper',
            reviewerName: scenario.zeroFeeReviewer.fullName,
          },
        ]),
      });
      return;
    }
    if (method === 'PUT') {
      let body: { status?: string } = {};
      try {
        body = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reviewRequestId: scenario.reviewRequestId,
          id: scenario.reviewRequestId,
          paperId: scenario.paperId,
          reviewerId: scenario.reviewerId,
          fee: 25000,
          status: body.status ?? 'Completed',
          paperTitle: 'E2E Main Review Flow Paper',
          reviewerName: scenario.zeroFeeReviewer.fullName,
        }),
      });
      return;
    }
    return route.continue();
  });

  // ── DetailedEvaluation — single combined handler for GET / POST / PUT.
  page.route(/\/api\/DetailedEvaluation(\/.*)?(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          detailedEvaluationId: scenario.evaluationId,
          reviewRequestId: scenario.reviewRequestId,
          reviewerId: scenario.reviewerId,
          finalDecision: 'Accept',
        }),
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          detailedEvaluationId: scenario.evaluationId,
          reviewRequestId: scenario.reviewRequestId,
          reviewerId: scenario.reviewerId,
          finalDecision: 'Accept',
          scoreOriginality: 4,
          notesOriginality: 'Solid originality.',
          scoreLiterature: 4,
          notesLiterature: 'Comprehensive literature review.',
          scoreMethodology: 5,
          notesMethodology: 'Sound methodology.',
          scoreResults: 4,
          notesResults: 'Results support the claims.',
          scoreFormatting: 5,
          notesFormatting: 'Well-formatted.',
          generalComments:
            'Accept — see detailed notes. (E2E captured; not a real evaluation.)',
        }),
      });
      return;
    }
    if (method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          detailedEvaluationId: scenario.evaluationId,
          reviewRequestId: scenario.reviewRequestId,
          reviewerId: scenario.reviewerId,
          finalDecision: 'Accept',
        }),
      });
      return;
    }
    return route.continue();
  });
}