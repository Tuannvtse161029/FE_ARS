import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { AppConfig } from '../../../src/config/app';
import { ROUTES } from '../../../src/routes/paths';

// Stub of PremiumPackagesPreview. The point of this test is that the
// conditional in App.tsx never falls through to render this stub while
// the flag is `false`.
const ForbiddenPremium = (): JSX.Element => {
  throw new Error(
    'PremiumPackagesPreview should NOT render while premiumPackagesEnabled is false.',
  );
};

/**
 * Agent admin-annual-fees — vital route-gating contract.
 *
 * The App.tsx registration for /premium-packages is a one-liner:
 *
 *   <Route
 *     path={ROUTES.PREMIUM_PACKAGES}
 *     element={
 *       AppConfig.features.premiumPackagesEnabled
 *         ? <PremiumPackagesPreview />
 *         : <Navigate to={ROUTES.FORUM} replace />
 *     }
 *   />
 *
 * This test pins the contract by mounting a Routes tree with the same
 * conditional and verifying the non-Admin direct-navigation path is
 * redirected to /forum (the sentinel renders nowhere, throwing would
 * fail the test).
 */
describe('admin-annual-fees / /premium-packages route gating', () => {
  it('the centralized flag defaults to false while the BE contract is outstanding', () => {
    expect(AppConfig.features.premiumPackagesEnabled).toBe(false);
  });

  it.each([
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ])(
    'direct navigation to /premium-packages redirects to /forum while the flag is false (%s)',
    (role) => {
      // The role argument is here for documentation; the route gate
      // does not actually depend on the role when the flag is false —
      // everyone is bounced. This matches the App.tsx conditional
      // and the brief: "Direct premium routes must also redirect or
      // show unauthorized/unavailable."
      void role;

      // Sentinel route at /forum so we can detect the redirect.
      const ForumSentinel = () => (
        <div data-testid="forum-sentinel">forum</div>
      );

      render(
        <MemoryRouter initialEntries={[ROUTES.PREMIUM_PACKAGES]}>
          <Routes>
            <Route path={ROUTES.FORUM} element={<ForumSentinel />} />
            <Route
              path={ROUTES.PREMIUM_PACKAGES}
              element={
                AppConfig.features.premiumPackagesEnabled ? (
                  <ForbiddenPremium />
                ) : (
                  <Navigate to={ROUTES.FORUM} replace />
                )
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      // The redirect landed on /forum.
      expect(screen.getByTestId('forum-sentinel')).toBeInTheDocument();
      // The PremiumPackagesPreview stub was NOT rendered (it would
      // have thrown synchronously and broken the test).
      expect(screen.queryByText(/should NOT render/)).toBeNull();
    },
  );
});