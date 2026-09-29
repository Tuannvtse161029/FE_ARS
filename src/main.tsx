import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/I18nContext';
import { Toaster } from 'sonner';
import { migratePersistedUser } from './utils/projectedUser';
import { secureToken } from './utils/secureToken';

// Session-2 boot migration: run before React mounts so guards reading
// `ars_user` during the first render see the projected shape, not the
// legacy blob with PII fields like `orcidId` and `suspendedUntil`.
migratePersistedUser();

// Best-effort: try to rehydrate the secureToken session from a refresh
// key (no-op until the BE ships the refresh endpoint — see
// `tickets/backend/BE-JWT-HTTPONLY-COOKIE.md`). The promise is not
// awaited because the React tree should mount immediately; the auth
// store picks up the result via the `ars-auth-storage` rehydration.
void secureToken.rehydrate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <Toaster richColors position="top-right" />
    </I18nProvider>
  </StrictMode>
);
