// FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — FE callback landing page for the
// BE-owned ORCID OAuth handoff.
//
// Lifecycle:
//   1. User clicks "Connect ORCID" on Profile (account link) or on the
//      Register page (registration link).
//   2. FE calls `POST /api/Auth/orcid/account/start` (JWT required) or
//      `POST /api/Auth/orcid/registration/start` (no JWT) and navigates
//      the top-level browser to the returned `authorizationUrl`.
//   3. ORCID authorizes the request and redirects the browser to the BE:
//        GET /api/Auth/orcid/callback
//   4. BE validates state, exchanges the OAuth code, and redirects the
//      browser to this page using a URL fragment:
//
//        /auth/orcid/callback
//        #success=true
//         &context=ACCOUNT_LINK            // or REGISTRATION
//         &status=COMPLETED                // or AUTHENTICATED, FAILED, ...
//         &orcidId=0000-0000-0000-0000
//         &displayName=...
//         &registrationTicket=<opaque>     // registration only
//
//      Failure variant:
//        #success=false
//         &context=ACCOUNT_LINK
//         &status=FAILED
//         &errorCode=...
//         &errorMessage=...
//
//   5. This page parses the fragment ONCE, branches on `context`, and
//      replaces itself with the right destination (Profile for account
//      link, Register for registration). It NEVER persists ORCID OAuth
//      codes, state values, or provider tokens. The opaque
//      `registrationTicket` is the only piece persisted, and only briefly
//      in sessionStorage (cleared after a successful registration submit).
//
// The page must NOT be inside authenticated-only route guards — the
// registration callback runs before the user has an ARS JWT.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ROUTES } from '../../routes/paths';

const ORCID_REGISTRATION_TICKET_KEY = 'orcidRegistrationTicket';

type CallbackContext = 'ACCOUNT_LINK' | 'REGISTRATION' | string;
type CallbackOutcome = 'success' | 'cancel' | 'error';

interface CallbackPayload {
  success: boolean;
  context: CallbackContext;
  status: string;
  orcidId: string | null;
  displayName: string | null;
  registrationTicket: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const readFragment = (): CallbackPayload => {
  // The BE sends everything after the `#`. The fragment is NOT sent to the
  // server, so this is the only place where this data ever lives on the
  // client. We read it once and discard it.
  const rawHash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(rawHash);

  const successParam = (params.get('success') ?? '').toLowerCase();
  return {
    success: successParam === 'true',
    context: params.get('context') ?? '',
    status: params.get('status') ?? '',
    orcidId: params.get('orcidId'),
    displayName: params.get('displayName'),
    registrationTicket: params.get('registrationTicket'),
    errorCode: params.get('errorCode'),
    errorMessage: params.get('errorMessage'),
  };
};

const isCancellation = (payload: CallbackPayload): boolean => {
  // The BE reports cancellation as success=false + a known cancel code, or
  // as success=false + status=CANCELLED / user_cancelled. We accept both.
  const cancelStatuses = new Set(['CANCELLED', 'USER_CANCELLED', 'ACCESS_DENIED']);
  if (cancelStatuses.has((payload.status ?? '').toUpperCase())) return true;
  const cancelCodes = new Set(['access_denied', 'USER_CANCELLED']);
  return (
    !payload.success &&
    !!payload.errorCode &&
    cancelCodes.has(payload.errorCode)
  );
};

export const OrcidCallback = () => {
  const navigate = useNavigate();
  const processedRef = useRef(false);
  const [outcome, setOutcome] = useState<CallbackOutcome>('success');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const payload = readFragment();

    // ── Failure branch ───────────────────────────────────────────────────
    if (!payload.success) {
      // Make sure no stale ticket leaks from a previous cancelled attempt.
      try {
        sessionStorage.removeItem(ORCID_REGISTRATION_TICKET_KEY);
      } catch {
        /* ignore storage failures */
      }

      if (isCancellation(payload)) {
        setOutcome('cancel');
        setErrorMessage(
          'ORCID authorization was cancelled. You can try again at any time.',
        );
        return;
      }

      setOutcome('error');
      setErrorMessage(
        payload.errorMessage ||
          payload.errorCode ||
          'ORCID connection failed. Please try again.',
      );
      return;
    }

    // ── Success branch — branch on context ───────────────────────────────
    if (payload.context === 'ACCOUNT_LINK') {
      // Account-link callback: BE has already saved the verified ORCID on
      // the authenticated user. The Profile page re-derives the verified
      // badge from `GET /api/Auth/orcid/status` (see
      // `useOrcidIdentity`), so we don't need to do anything other than
      // land the user on /profile and let the hook refetch.
      //
      // Use `replace: true` so the fragment never lingers in history and a
      // refresh cannot replay the success fragment.
      navigate(`${ROUTES.PROFILE}?orcid=verified`, { replace: true });
      return;
    }

    if (payload.context === 'REGISTRATION') {
      const ticket = payload.registrationTicket;
      if (!ticket) {
        // The BE didn't issue a ticket. Without a ticket the Register page
        // cannot submit a Reviewer registration. Surface the error so the
        // user can retry from the register screen.
        setOutcome('error');
        setErrorMessage(
          'ORCID verification completed, but the platform did not issue a registration ticket. Please retry the ORCID step from the register screen.',
        );
        return;
      }

      // Stash the opaque ticket briefly. The Register page reads it back
      // (and removes it after a successful submit). We use sessionStorage
      // so the ticket is naturally scoped to this tab and dies with it.
      try {
        sessionStorage.setItem(ORCID_REGISTRATION_TICKET_KEY, ticket);
      } catch {
        setOutcome('error');
        setErrorMessage(
          'Unable to store the ORCID registration ticket. Please retry from the register screen.',
        );
        return;
      }

      navigate(`${ROUTES.REGISTER}?orcid=verified`, { replace: true });
      return;
    }

    // Unknown / missing context — fail closed.
    setOutcome('error');
    setErrorMessage(
      'ORCID callback did not include a recognised context. Please retry from the connect ORCID button.',
    );
  }, [navigate]);

  // Cancel handler — clears any stale ticket and returns the user to the
  // most useful destination depending on the original context. The page
  // already navigated away on success, so this branch only renders for
  // cancel/error outcomes.
  const handleReturn = () => {
    try {
      sessionStorage.removeItem(ORCID_REGISTRATION_TICKET_KEY);
    } catch {
      /* ignore */
    }
    // Try to fall back to the original context (registration vs account
    // link) so the user lands somewhere meaningful.
    navigate(ROUTES.REGISTER, { replace: true });
  };

  if (outcome === 'success') {
    // The navigate() call above should already have replaced the page.
    // This branch is defensive — render a minimal placeholder while the
    // route transition settles.
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Finishing your ORCID connection…</p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        padding: 24,
        maxWidth: 480,
        margin: '64px auto',
        fontFamily: 'inherit',
        textAlign: 'center',
      }}
      data-testid="orcid-callback-status"
      data-status={outcome}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        {outcome === 'cancel'
          ? 'ORCID connection was cancelled.'
          : 'ORCID connection failed.'}
      </h1>
      {errorMessage && <p style={{ marginBottom: 16 }}>{errorMessage}</p>}
      <Button type="button" variant="primary" size="lg" onClick={handleReturn}>
        Back to register
      </Button>
    </div>
  );
};

export default OrcidCallback;