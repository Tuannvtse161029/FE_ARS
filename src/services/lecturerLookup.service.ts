// Grad-side silent lecturer-name lookup.
//
// Per docs/local-only/lead-phase-c-contract.md G5(d):
//   - The BE does not expose a structured `/api/User/{id}` lookup that the
//     Grad dashboard relies on. The existing placeholder convention is
//     `Lecturer #<id>`.
//   - We add a small cache + fire-and-forget probe so the dashboard and
//     workspace CAN show a real name when `/api/User/{id}` responds, but a
//     failed lookup is invisible to the student (no toast, no error banner).
//   - The cache is module-scoped so repeated lookups for the same id dedupe
//     to one network request per session per id.
//
// This is a Grad-side helper (does not touch the shared `userService` shape)
// — Agent 1's `useLecturerProfile` is the parallel surface on the Lecturer
// side and uses a separate cache per the contract O-5 disposition.

import { userService } from './user.service';

const cache = new Map<number, string>();
const inflight = new Map<number, Promise<void>>();

const fallbackName = (lecturerId: number): string => `Lecturer #${lecturerId}`;

/**
 * Synchronously return the cached display name for a lecturer, or a
 * `Lecturer #<id>` fallback when the cache is empty. Safe to call inside
 * render — no network, no thrown errors.
 */
export const getLecturerDisplayName = (lecturerId: number | null | undefined): string => {
  if (typeof lecturerId !== 'number' || lecturerId <= 0) {
    return 'Lecturer';
  }
  const cached = cache.get(lecturerId);
  return cached ?? fallbackName(lecturerId);
};

/**
 * Trigger a fire-and-forget probe against `userService.getById(lecturerId)`
 * to populate the cache. Failures are swallowed (no toast). The Promise is
 * intentionally NOT returned — callers MUST treat this as a best-effort
 * decoration.
 */
export const ensureLecturerDisplayName = (lecturerId: number | null | undefined): void => {
  if (typeof lecturerId !== 'number' || lecturerId <= 0) return;
  if (cache.has(lecturerId) || inflight.has(lecturerId)) return;
  const promise = (async () => {
    try {
      const user = await userService.getById(lecturerId);
      const name = (user.fullName ?? user.username ?? '').trim();
      if (name.length > 0) {
        cache.set(lecturerId, name);
        // Trigger a custom event so any mounted component re-renders with
        // the resolved name. We deliberately do NOT import a hook here so
        // this module stays side-effect-free at import time.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ars:lecturer-name-resolved', { detail: { lecturerId } }),
          );
        }
      }
    } catch {
      // Silent failure — keep the `Lecturer #<id>` fallback.
    } finally {
      inflight.delete(lecturerId);
    }
  })();
  inflight.set(lecturerId, promise);
};

/**
 * Test-only helper. Clears the in-memory cache + inflight set so unit tests
 * don't bleed state between cases. Production code MUST NOT call this.
 */
export const __resetLecturerDisplayNameCacheForTests = (): void => {
  cache.clear();
  inflight.clear();
};

export const lecturerLookupService = {
  getLecturerDisplayName,
  ensureLecturerDisplayName,
};

export default lecturerLookupService;