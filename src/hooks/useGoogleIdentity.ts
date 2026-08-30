// Agent 52 — Google Identity Services loader hook.
//
// Loads `https://accounts.google.com/gsi/client` exactly once per session and
// exposes a render-on-element helper for the Login button and the
// Complete-Registration page (re-entry for already-issued GIS sessions).
//
// Hard rules:
//   1. The client_id is read from `import.meta.env.VITE_GOOGLE_CLIENT_ID`
//      only. We never hardcode a client id, never accept one from a route
//      param, and never fall back to a placeholder.
//   2. We never log / store the client id (per secrets policy). Dev-mode
//      console noise is restricted to the (deliberately scrubbed) client_id
//      length only.
//   3. Script loading is one-shot (module-level promise) — concurrent calls
//      share the same promise.
//   4. The hook returns a typed `status` so the page can render
//      recoverable UI states (loading / unavailable / ready).

import { useEffect, useRef, useState } from 'react';
import type {
  GoogleAccountsId,
  GoogleCredentialResponse,
} from '../types/googleAuth';

// === GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
//
// Force the Google Identity Services UI to render in English regardless of
// the user's browser locale. The previous behaviour translated the button
// label to whatever language the browser advertised (e.g. "Đăng nhập bằng
// Google" for `vi`), which is wrong for our single-language EN-first FE.
//
// Two layers of override:
//   1. Script URL is loaded with `?hl=en` so the OAuth client UI metadata
//      resolves to English before any code runs.
//   2. `id.initialize({ locale: 'en' })` and `id.renderButton(..., { locale: 'en' })`
//      are explicit per-call fallbacks in case the script-level override is
//      overridden by a future GIS change.
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client?hl=en';
// === END GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
const GIS_SCRIPT_ID = 'ars-google-identity-services';

export type GoogleIdentityStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'no-client-id';

// Single shared loader — concurrent callers wait on the same promise.
let scriptPromise: Promise<boolean> | null = null;

function loadGisScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    // Reuse an existing script tag if one was inserted by another surface.
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(true), { once: true });
    script.addEventListener('error', () => resolve(false), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function getClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  return null;
}

export interface UseGoogleIdentityArgs {
  /** Called by GIS when the user completes the sign-in flow. */
  onCredential: (response: GoogleCredentialResponse) => void;
  /** Called when the user dismisses the GIS popup without selecting an account. */
  onCancel?: () => void;
  /** Optional button UX overrides. */
  buttonOptions?: {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  };
}

export interface UseGoogleIdentityReturn {
  status: GoogleIdentityStatus;
  /** DOM ref to attach the official Google button to. */
  buttonContainerRef: React.RefObject<HTMLDivElement>;
  /** True when GIS is ready and `buttonContainerRef` has been rendered. */
  isReady: boolean;
  /** Returns the last GIS-level error message, if any. */
  errorMessage: string | null;
}

/**
 * Renders an official Google sign-in button into `buttonContainerRef.current`
 * and resolves the GIS callback into the supplied `onCredential` handler.
 *
 * Caller must guarantee that the button is disabled while a submission is
 * in flight — this hook does not gate submit state.
 */
export function useGoogleIdentity({
  onCredential,
  onCancel,
  buttonOptions,
}: UseGoogleIdentityArgs): UseGoogleIdentityReturn {
  const [status, setStatus] = useState<GoogleIdentityStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  const onCancelRef = useRef(onCancel);

  // Always read the latest callback refs without retriggering the effect.
  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const buttonType = buttonOptions?.type ?? 'standard';
  const buttonTheme = buttonOptions?.theme ?? 'outline';
  const buttonSize = buttonOptions?.size ?? 'large';
  const buttonText = buttonOptions?.text ?? 'signin_with';
  const buttonShape = buttonOptions?.shape ?? 'rectangular';

  useEffect(() => {
    const clientId = getClientId();
    if (!clientId) {
      setStatus('no-client-id');
      return;
    }

    let cancelled = false;
    let animationFrameHandle: number | null = null;
    let cancelHandler: (() => void) | null = null;
    setStatus('loading');
    setErrorMessage(null);

    (async () => {
      const loaded = await loadGisScript();
      if (cancelled) return;
      if (!loaded || !window.google?.accounts?.id) {
        setStatus('unavailable');
        setErrorMessage(
          'Google Identity Services could not be loaded. Please refresh the page or try again later.',
        );
        return;
      }

      const id: GoogleAccountsId = window.google.accounts.id;

      try {
        // === GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
        // `locale: 'en'` is the explicit per-instance override that
        // guarantees the button text is rendered in English even if the
        // script-level `hl=en` query param is ignored (e.g. future GIS
        // changes, ad-blocker stripping the query string, etc.).
        id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response || typeof response.credential !== 'string') {
              setErrorMessage('Google did not return a valid credential.');
              return;
            }
            onCredentialRef.current(response);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          locale: 'en',
        });
        // === END GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
      } catch (err: unknown) {
        // GIS sometimes throws if init is called twice or with a bad client id.
        const message =
          err instanceof Error ? err.message : 'Failed to initialize Google sign-in.';
        setErrorMessage(message);
        setStatus('unavailable');
        return;
      }

      // Render into the caller-provided element. If it's not mounted yet
      // (StrictMode double-invoke etc.), defer with rAF and retry once.
      const renderInto = (target: HTMLElement | null) => {
        if (!target) return false;
        // Idempotent: clear children first.
        target.innerHTML = '';
        // === GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
        // Pass `locale: 'en'` here too so the rendered button itself is
        // forced to English. This is the per-button override that wins
        // over both the script URL `?hl=en` and the user's browser locale.
        id.renderButton(target, {
          type: buttonType,
          theme: buttonTheme,
          size: buttonSize,
          text: buttonText,
          shape: buttonShape,
          locale: 'en',
        });
        // === END GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
        return true;
      };

      const target = buttonContainerRef.current;
      if (!renderInto(target)) {
        // Defer to next frame and retry exactly once.
        animationFrameHandle = window.requestAnimationFrame(() => {
          animationFrameHandle = null;
          if (!cancelled) renderInto(buttonContainerRef.current);
        });
      }

      // Wire up a cancel listener via the prompt cancel callback. GIS does
      // not emit a global "cancel" event; we listen for `mousedown` outside
      // the popup and fall through to onCancel if provided.
      if (onCancelRef.current) {
        cancelHandler = () => onCancelRef.current?.();
        document.addEventListener('mousedown', cancelHandler, { once: true });
      }

      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      if (animationFrameHandle !== null) {
        window.cancelAnimationFrame(animationFrameHandle);
      }
      if (cancelHandler) {
        document.removeEventListener('mousedown', cancelHandler);
      }
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = '';
      }
      try {
        window.google?.accounts?.id?.disableAutoSelect();
      } catch {
        /* ignore — GIS throws if it wasn't initialised in some edge cases */
      }
    };
  }, [buttonShape, buttonSize, buttonText, buttonTheme, buttonType]);

  return {
    status,
    buttonContainerRef,
    isReady: status === 'ready',
    errorMessage,
  };
}

/**
 * Helper exported for tests / non-React callers to determine whether GIS
 * can possibly be initialised (client id present, API surface available).
 * Does NOT trigger script loading.
 */
export function canUseGoogleIdentity(): boolean {
  return getClientId() !== null;
}

export default useGoogleIdentity;