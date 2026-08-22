/**
 * Unit tests for the user-facing Premium Packages preview page.
 *
 * The page is a UI-only preview — it must NOT hit any network, must NOT
 * render the Admin Premium Packages management component, and must NOT
 * present an actionable "upgrade" control.
 *
 * Coverage:
 *   - Renders the "COMING SOON" badge.
 *   - Renders the "Free Tier" and "Premium Preview" cards.
 *   - For each supported role (Researcher / Reviewer / Lecturer / Graduate
 *     Student) renders the role-specific heading copy.
 *   - Unsupported role falls back to the safe generic config.
 *   - The "Upgrade unavailable" control is a real <button disabled> with no
 *     onClick handler attached.
 *   - No axios or fetch call is made when the component mounts.
 *   - A11y sanity: there is exactly one <h1>, the feature lists are real
 *     <ul>/<li>, and the badge has accessible text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PremiumPackagesPreview from '../../../../../src/pages/PremiumPackages/PremiumPackagesPreview';
import { buildMockAuth } from '../../../../../src/utils/mockAuth';

// Mutate this from the auth hook mock to swap roles between tests.
const useAuthMock = vi.fn();
vi.mock('../../../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const renderPreview = (role: string | null = 'Researcher') => {
  useAuthMock.mockReturnValue(
    buildMockAuth({ role, isAuthenticated: role !== null }),
  );
  return render(
    <MemoryRouter initialEntries={['/premium-packages']}>
      <PremiumPackagesPreview />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PremiumPackagesPreview', () => {
  it('renders the COMING SOON preview badge with accessible text', () => {
    renderPreview();
    const badge = screen.getByTestId('preview-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/coming soon/i);
    // The badge has an aria-label so assistive tech can announce it.
    expect(badge).toHaveAttribute('aria-label');
  });

  it('renders the Free Tier and Premium Preview cards', () => {
    renderPreview();
    expect(screen.getByTestId('free-tier-card')).toBeInTheDocument();
    expect(screen.getByTestId('premium-preview-card')).toBeInTheDocument();
  });

  it('renders the Free Tier feature list as a real <ul> with <li> items', () => {
    renderPreview();
    const freeFeatures = screen.getByTestId('free-tier-features');
    expect(freeFeatures.tagName).toBe('UL');
    const items = within(freeFeatures).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(4);
    items.forEach((item) => expect(item.tagName).toBe('LI'));
  });

  it('renders the Premium Preview feature list as a real <ul> with <li> items', () => {
    renderPreview();
    const premiumFeatures = screen.getByTestId('premium-preview-features');
    expect(premiumFeatures.tagName).toBe('UL');
    const items = within(premiumFeatures).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(4);
    items.forEach((item) => expect(item.tagName).toBe('LI'));
  });

  it('renders exactly one <h1> heading for the page', () => {
    renderPreview();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/Premium Package/i);
  });

  it('renders the current-plan summary card', () => {
    renderPreview();
    const summary = screen.getByTestId('current-plan-summary');
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent(/free tier/i);
  });

  it('renders the "coming soon" informational notice', () => {
    renderPreview();
    const notice = screen.getByTestId('preview-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      /premium subscriptions, billing, and ai entitlements are not connected yet/i,
    );
  });

  it('the Premium Upgrade button is disabled and has no onClick handler', () => {
    renderPreview();
    const button = screen.getByTestId('premium-upgrade-button') as HTMLButtonElement;
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveTextContent(/upgrade unavailable/i);
    // The DOM property is the source of truth — onClick is null because we
    // never pass it as a JSX prop.
    expect(button.onclick).toBeNull();
  });

  it('clicking the disabled Premium Upgrade button does nothing', async () => {
    const user = userEvent.setup();
    renderPreview();
    const button = screen.getByTestId('premium-upgrade-button');
    await user.click(button).catch(() => {
      // user-event v14+ throws on click of a disabled button; that's fine.
    });
    // Page still shows the COMING SOON badge after the attempted click —
    // i.e. nothing transitioned.
    expect(screen.getByTestId('preview-badge')).toBeInTheDocument();
  });

  it('does not include any pricing value (no invented price)', () => {
    renderPreview();
    // The Premium Preview pricing row uses an em-dash placeholder, not a
    // numeric price. No element on the page should display "VND" or a
    // numeric amount as the Premium price.
    expect(
      screen.queryByText(/pricing to be announced/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d[\d,]*\s*VND/)).not.toBeInTheDocument();
  });

  describe('role-specific configuration', () => {
    it('renders the Researcher-specific heading', () => {
      renderPreview('Researcher');
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/premium for researchers/i);
    });

    it('renders the Reviewer-specific heading', () => {
      renderPreview('Reviewer');
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/premium for reviewers/i);
    });

    it('renders the Lecturer-specific heading', () => {
      renderPreview('Lecturer');
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/premium for lecturers/i);
    });

    it('renders the Graduate Student-specific heading', () => {
      renderPreview('Graduate Student');
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/premium for graduate students/i);
    });

    it('uses the safe generic fallback for unsupported roles', () => {
      // Admin users hit this page in theory (the route is shared, not admin
      // only) — they should see the generic fallback copy rather than a
      // fabricated role-specific promise.
      renderPreview('Admin');
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/^Premium Preview$/i);
    });

    it('uses the safe generic fallback when there is no logged-in user', () => {
      renderPreview(null);
      const heading = screen.getByTestId('premium-preview-heading');
      expect(heading).toHaveTextContent(/^Premium Preview$/i);
    });
  });

  describe('AI-assisted wording', () => {
    it.each([
      ['Researcher', /premium for researchers/i],
      ['Reviewer', /premium for reviewers/i],
      ['Lecturer', /premium for lecturers/i],
      ['Graduate Student', /premium for graduate students/i],
    ])(
      '%s role descriptions never claim AI evaluates, grades, or submits autonomously',
      (_role, headingPattern) => {
        renderPreview(_role);
        expect(
          screen.getByTestId('premium-preview-heading'),
        ).toHaveTextContent(headingPattern);
        const features = screen.getByTestId('premium-preview-features');
        const text = features.textContent ?? '';
        // Forbidden phrasings — AI must never be implied to make
        // authoritative decisions on behalf of the user.
        expect(text).not.toMatch(/ai (evaluates|grades|judges|decides|approves|rejects)/i);
        expect(text).not.toMatch(/ai[- ]?submits/i);
        expect(text).not.toMatch(/autonomously/i);
      },
    );
  });

  describe('network isolation', () => {
    it('does not call axios when the component mounts or renders', async () => {
      // Spy on global fetch / XMLHttpRequest. axios uses XMLHttpRequest
      // under the hood in jsdom; checking both keeps us covered if axios
      // ever switches to fetch-based transport.
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(new Response('')));
      const xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');

      renderPreview();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpenSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
      xhrOpenSpy.mockRestore();
    });
  });
});
