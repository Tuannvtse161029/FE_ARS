/**
 * annualFee service — `getMyCurrentSubscription` plan fallback contract.
 *
 * The `MySubscriptionResponse` schema advertises an embedded `annualFee`
 * plan object, but the BE has historically returned a subscription row
 * with `annualFee: null` for users that acquired an expiry through
 * admin DB writes (no `AnnualFeePurchase`, no `AnnualFee` plan).
 *
 * The FE used to synthesize a fake plan with the name
 * `"${daysRemaining}-Day Subscription"` and show it as the user's
 * current plan. That was misleading: a user with 249 days remaining
 * would see a card titled "249-Day Subscription" and reasonably
 * believe they'd bought a "249-day plan" — which they had not.
 *
 * This test pins the new contract:
 *   - When the BE returns a row with no embedded `annualFee`, the
 *     service surfaces `annualFee = null` (no synthesized plan).
 *   - The day count, expiry, and isExpired flag still flow through.
 *   - When the BE does include an embedded `annualFee` object, the
 *     service passes it through unchanged (name, role, price, etc.).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { getMyCurrentSubscription } from '../../../src/services/annualFee.service';

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('annualFee.getMyCurrentSubscription — plan fallback contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns annualFee=null when the BE has a subscription row but no embedded plan', async () => {
    // The shape the BE returns when an admin inserted an expiry date
    // directly into the DB — there is a subscription row but no plan
    // record to embed.
    mockedApi.get.mockResolvedValueOnce({
      data: {
        purchase: {
          annualFeeId: 42,
          amount: 0,
          expiryDate: '2027-10-03T00:00:00.000Z',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
        // annualFee is null — the BE couldn't find a plan to embed.
        annualFee: null,
        daysRemaining: 365,
        isExpired: false,
        expiresAt: '2027-10-03T00:00:00.000Z',
      },
    });

    const result = await getMyCurrentSubscription();

    expect(result).not.toBeNull();
    expect(result?.annualFee).toBeNull();
    expect(result?.daysRemaining).toBe(365);
    expect(result?.isExpired).toBe(false);
    expect(result?.expiresAt).toBe('2027-10-03T00:00:00.000Z');
    expect(result?.purchase?.annualFeeId).toBe(42);
  });

  it('returns the embedded plan unchanged when the BE provides one', async () => {
    // The shape the BE returns for a normal purchase — the plan is
    // embedded so the UI can show "Researcher Yearly" (or whatever
    // the admin named the plan).
    mockedApi.get.mockResolvedValueOnce({
      data: {
        purchase: {
          annualFeeId: 7,
          amount: 900000,
          expiryDate: '2027-10-03T00:00:00.000Z',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
        annualFee: {
          id: 7,
          name: 'Researcher Yearly',
          userRole: 'Researcher',
          price: 900000,
          billingCycle: 'Annual',
          startDate: '2026-10-03T00:00:00.000Z',
          endDate: null,
          status: true,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        daysRemaining: 365,
        isExpired: false,
        expiresAt: '2027-10-03T00:00:00.000Z',
      },
    });

    const result = await getMyCurrentSubscription();

    expect(result).not.toBeNull();
    expect(result?.annualFee).not.toBeNull();
    expect(result?.annualFee?.name).toBe('Researcher Yearly');
    expect(result?.annualFee?.price).toBe(900000);
    expect(result?.daysRemaining).toBe(365);
  });

  it('returns null when the BE responds with the canonical "no subscription" message', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { message: 'No active subscription.' },
    });

    const result = await getMyCurrentSubscription();
    expect(result).toBeNull();
  });
});
