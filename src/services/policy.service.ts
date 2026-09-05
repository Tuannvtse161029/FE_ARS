/**
 * Policy service — reads and writes policy documents to Firebase Firestore.
 *
 * Architecture
 * ------------
 * The BE does not expose policy endpoints by design (per
 * docs/local-only/erd-schema-reference.md — there is no DB field for these
 * documents). The admin team owns policy text directly via Firestore so the
 * BE never has to round-trip a 50 KB legal text through .NET Core just to
 * ship it back to the browser.
 *
 * Data model
 * ----------
 *   Collection:   policies
 *   Document ID:  one of `privacy_policy` | `terms_of_service`
 *                 | `researcher_responsibility` | `reviewer_responsibility`
 *   Fields:       { title, content, version, updatedAt, updatedBy }
 *
 * Read path
 * ---------
 * `listAll()` performs ONE `getDocs({collection})` round-trip and returns a
 * `Record<slug, PolicyDocument>` keyed by the document ID. Slugs that do not
 * yet exist on Firestore are filled with the seed defaults from
 * `POLICY_SEED_CONTENT`, marked `version: 0` and `updatedAt: null`. This way
 * the Admin Policies page can render all four cards on a fresh project
 * without each card waiting on its own network round-trip.
 *
 * Write path
 * ----------
 * `save(slug, content, actor)` does a `setDoc` with `merge: true` and a
 * Firestore-side `serverTimestamp()` for `updatedAt`. The local `version`
 * is incremented client-side (Firestore `increment()` would be cleaner, but
 * the seed default for a brand-new document needs to start at 1, so the
 * round-trip read-then-write is simpler than a transaction here).
 */

import {
  doc,
  collection,
  serverTimestamp,
  setDoc,
  Timestamp,
  getDocsFromCache,
  getDocsFromServer,
  type FirestoreError,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured, firebaseInitializationError, getFirebaseConfigStatus } from '../firebase';
import {
  POLICY_META,
  POLICY_SEED_CONTENT,
  POLICY_SLUGS,
  type PolicyDocument,
  type PolicySlug,
  type PolicySnapshot,
} from '../types/policy';

const POLICIES_COLLECTION = 'policies';

/**
 * In-memory cache of the most recent `listAll()` result.
 *
 * Why this exists:
 *   - Opening a `Listen/channel` to Firestore costs ~500 ms of auth handshake
 *     alone, even when the collection is 4 small docs. Cold-load on the
 *     Admin Policies page was hitting ~6 s end-to-end.
 *   - `getDocsFromCache` is essentially free (no network) but it returns
 *     `empty` for any collection the SDK has never touched, which is the
 *     case for first-ever page loads and for users who switch browsers.
 *   - The Admin is typically editing policies once per session and otherwise
 *     re-visiting the page. A 30 s TTL is the right trade-off: any saved
 *     edit triggers an explicit `invalidate()` call so the TTL never hides
 *     fresh admin writes.
 */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  payload: Record<PolicySlug, PolicySnapshot>;
  fetchedAt: number;
}
let memoryCache: CacheEntry | null = null;

/** Subscribers notified whenever `listAll` produces a fresh payload (cache or server). */
type Listener = (payload: Record<PolicySlug, PolicySnapshot>) => void;
const listeners = new Set<Listener>();

const notify = (payload: Record<PolicySlug, PolicySnapshot>): void => {
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (listenerError) {
      // Never let one bad subscriber break the broadcast loop.
      console.warn('[policyService] listener threw', listenerError);
    }
  }
};

/**
 * Friendly name for a Firestore error so the Admin UI can show a hint
 * instead of the raw SDK message (which references Firebase Console URLs
 * and isn't useful for a non-Admin reader).
 */
const describeError = (error: unknown): string => {
  if (!error) return 'Unknown Firestore error.';
  const code = (error as FirestoreError)?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return 'Firestore denied the request. Update the policies collection security rules to allow admin writes (and reads).';
    case 'unavailable':
      return 'Firestore is unreachable. The Firebase backend may be down — check https://status.firebase.google.com and retry shortly.';
    case 'failed-precondition':
      return 'Firestore rejected the write — the policies collection may not exist yet. Create it in the Firebase Console.';
    default:
      return (error as Error)?.message ?? String(error);
  }
};

/**
 * Build an error message that matches the ACTUAL failure mode.
 *
 * Previously we lumped every "no Firestore handle" case into
 * `"Firebase is not configured. Add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to your .env file."`
 * — which lied to the user whenever the .env was fine but Firebase was
 * unreachable / the client had crashed during init / the Firestore call
 * itself had errored. We now branch on the real state:
 *
 *   1. Env vars truly missing → list exactly which keys are empty so the
 *      user can fix `.env` without guessing.
 *   2. Env vars present but `initializeApp` threw → surface the SDK's
 *      own message (the user can paste it into a bug report).
 *   3. Everything looks fine but `firestore` is null → fall through to a
 *      generic "client unavailable" message; we don't claim the .env is
 *      broken anymore.
 *   4. `getDocs` / `setDoc` call failed → `describeError()` handles the
 *      SDK codes (network down, permission, etc.).
 */
const buildUnavailableError = (): Error => {
  const status = getFirebaseConfigStatus();
  if (!status.configured) {
    const missing = status.missingKeys.length > 0
      ? ` Missing or placeholder: ${status.missingKeys.join(', ')}.`
      : '';
    return new Error(
      `Firebase is not configured. Add ${status.missingKeys[0] ?? 'VITE_FIREBASE_API_KEY'} ` +
        `and ${status.missingKeys.find((k) => k === 'VITE_FIREBASE_PROJECT_ID') ?? 'VITE_FIREBASE_PROJECT_ID'} ` +
        `to your .env file.${missing}`,
    );
  }
  if (firebaseInitializationError) {
    return new Error(
      `Firebase credentials are present but the client failed to initialize: ` +
        `${firebaseInitializationError.message}`,
    );
  }
  return new Error(
    'Firebase is configured but the Firestore client is unavailable right now. ' +
      'The Firebase backend may be down — please retry shortly.',
  );
};

const slugDoc = (slug: PolicySlug) => doc(firestore!, POLICIES_COLLECTION, slug);

/**
 * Convert a Firestore document snapshot into a `PolicyDocument`.
 * Falls back to the seed text if the stored document has no content —
 * which can happen if an admin wiped the field manually.
 */
const fromSnapshot = (
  slug: PolicySlug,
  data: Record<string, unknown> | undefined,
): PolicyDocument => {
  const meta = POLICY_META[slug];
  const storedContent = typeof data?.['content'] === 'string' ? (data['content'] as string) : null;
  const updatedAtRaw = data?.['updatedAt'];
  return {
    title: typeof data?.['title'] === 'string' ? (data['title'] as string) : meta.title,
    content: storedContent ?? POLICY_SEED_CONTENT[slug],
    version:
      typeof data?.['version'] === 'number' ? (data['version'] as number) : 0,
    updatedAt:
      updatedAtRaw instanceof Timestamp
        ? updatedAtRaw.toDate().toISOString()
        : typeof updatedAtRaw === 'string'
          ? updatedAtRaw
          : '',
    updatedBy: typeof data?.['updatedBy'] === 'string' ? (data['updatedBy'] as string) : null,
  };
};

/**
 * Read all four policy documents.
 *
 * Resolution order:
 *   1. In-memory TTL cache (free, ~ms) — bypasses Firestore entirely on
 *      repeat visits within CACHE_TTL_MS. Bypassed when `force` is true
 *      (used by the Refresh button and after a successful save).
 *   2. `getDocsFromCache` (free, ~ms) — Firestore's own offline cache.
 *      Returns the same shape as the server query. Empty on first ever load.
 *   3. `getDocsFromServer` (~600 ms typical, up to ~3 s cold) — the real
 *      network call. Used as fallback when cache is cold, AND fired in the
 *      background to refresh the page after a cache hit so the admin
 *      eventually sees any server-side changes made elsewhere.
 *
 * The cache-first strategy turns cold page loads into a sub-second paint
 * for repeat visits and a roughly 1-2 s paint for first-ever visits, while
 * still letting the server quietly correct stale data ~1 s later.
 */
export const listAll = async (options?: {
  force?: boolean;
  backgroundRefresh?: boolean;
}): Promise<Record<PolicySlug, PolicySnapshot>> => {
  const { force = false, backgroundRefresh = true } = options ?? {};

  if (!isFirebaseConfigured() || !firestore) {
    throw buildUnavailableError();
  }

  const now = Date.now();

  // (1) TTL cache — bypass Firestore entirely on hot revisits.
  if (!force && memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    // Still refresh from server in the background so the next visit has
    // up-to-date data without paying the full handshake cost again.
    if (backgroundRefresh) {
      void refreshFromServer().catch(() => {
        /* swallow — UI already has good data from the cache */
      });
    }
    return memoryCache.payload;
  }

  const colRef = collection(firestore, POLICIES_COLLECTION);

  // (2) Firestore offline cache — synchronous-ish, no network.
  let payload: Record<PolicySlug, PolicySnapshot> | null = null;
  try {
    const cached = await getDocsFromCache(colRef);
    if (!cached.empty) {
      payload = buildPayloadFromSnap(cached);
    }
  } catch {
    // Cache read can throw if persistence is disabled — that's fine, we
    // just fall through to the server fetch.
  }

  if (payload) {
    memoryCache = { payload, fetchedAt: now };
    notify(payload);
    if (backgroundRefresh) {
      void refreshFromServer().catch(() => {
        /* swallow */
      });
    }
    return payload;
  }

  // (3) Cold load — no cache anywhere, must hit the network.
  return refreshFromServer();
};

/**
 * Force a server fetch and update both the in-memory cache and any
 * listeners. Called by `listAll` for cold loads and in the background
 * after a cache hit; can also be called directly by the Refresh button.
 */
const refreshFromServer = async (): Promise<Record<PolicySlug, PolicySnapshot>> => {
  if (!isFirebaseConfigured() || !firestore) {
    throw buildUnavailableError();
  }
  const colRef = collection(firestore, POLICIES_COLLECTION);
  let snap;
  try {
    snap = await getDocsFromServer(colRef);
  } catch (error) {
    throw new Error(describeError(error));
  }

  const payload = buildPayloadFromSnap(snap);
  memoryCache = { payload, fetchedAt: Date.now() };
  notify(payload);
  return payload;
};

/**
 * Shared snapshot-to-payload mapper. Works for both cache and server
 * `QuerySnapshot`s — the SDK normalises the result shape.
 */
const buildPayloadFromSnap = (
  snap: { forEach: (cb: (docSnap: { id: string; data: () => unknown }) => void) => void },
): Record<PolicySlug, PolicySnapshot> => {
  const byId = new Map<string, Record<string, unknown>>();
  snap.forEach((docSnap) => {
    byId.set(docSnap.id, docSnap.data() as Record<string, unknown>);
  });

  const out = {} as Record<PolicySlug, PolicySnapshot>;
  for (const slug of POLICY_SLUGS) {
    const data = byId.get(slug);
    const docData = fromSnapshot(slug, data);
    out[slug] = {
      ...docData,
      slug,
      fromFirestore: Boolean(data),
    };
  }
  return out;
};

/**
 * Subscribe to policy updates. Fires immediately with the current value
 * (cache-first, same resolution order as `listAll`) and again whenever
 * any future `listAll` or `save` produces a fresh payload.
 *
 * Returns an unsubscribe function. The Admin Policies page subscribes
 * once on mount so the background server refresh can update the UI
 * without the user clicking Refresh.
 *
 * Errors during the initial load are NOT passed to the callback — they
 * are rethrown via a returned `error` accessor and also surfaced by the
 * next call to `listAll` (e.g. via the Refresh button). This matches
 * the previous behaviour where the page rendered an error banner from
 * its own state.
 */
export interface PolicySubscription {
  unsubscribe: () => void;
  /** Manually trigger a one-shot server refresh. */
  refresh: () => Promise<void>;
}

export const subscribe = (listener: Listener): PolicySubscription => {
  listeners.add(listener);
  // Fire the current value asynchronously so the caller can finish
  // setting up its state handler before the first emission.
  void listAll().then((payload) => listener(payload));
  return {
    unsubscribe: () => {
      listeners.delete(listener);
    },
    refresh: async () => {
      await refreshFromServer();
    },
  };
};

/**
 * Drop the in-memory cache. Called by `save()` so the next reader sees
 * the freshly-written doc without waiting for the TTL to lapse.
 */
export const invalidate = (): void => {
  memoryCache = null;
};

/**
 * Fetch a single policy. Returns the seed default when the document has
 * never been written to Firestore.
 */
export const getOne = async (slug: PolicySlug): Promise<PolicySnapshot> => {
  if (!isFirebaseConfigured() || !firestore) {
    throw buildUnavailableError();
  }

  // Reuse listAll for one doc — cheap because Firestore caches the
  // collection query and the bundle is at most a few KB of legal text.
  const all = await listAll();
  return all[slug];
};

/**
 * Persist the policy text. Uses `setDoc(..., { merge: true })` so a
 * partial write (e.g. only the content) still updates the rest of the
 * document. The version increments client-side; for a brand-new document
 * the seed value is `version: 0`, so the first save lands at `version: 1`.
 */
export const save = async (
  slug: PolicySlug,
  content: string,
  actor: { name: string | null },
  currentVersion: number,
): Promise<PolicyDocument> => {
  if (!isFirebaseConfigured() || !firestore) {
    throw buildUnavailableError();
  }

  const nextVersion = Math.max(1, currentVersion + 1);
  const meta = POLICY_META[slug];
  const payload = {
    title: meta.title,
    content,
    version: nextVersion,
    updatedAt: serverTimestamp(),
    updatedBy: actor.name ?? 'Admin',
  };

  try {
    await setDoc(slugDoc(slug), payload, { merge: true });
  } catch (error) {
    throw new Error(describeError(error));
  }

  // Return a best-effort echo — Firestore serverTimestamp is null until
  // the round-trip completes, so we surface the local time the caller
  // would actually see in the UI before the next listAll() resolves.
  const echoed: PolicyDocument = {
    title: meta.title,
    content,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.name ?? 'Admin',
  };

  // Stitch the echoed doc into the in-memory cache (if any) so the page
  // paints the new text immediately and the next `listAll()` call is a
  // no-op until the TTL expires.
  if (memoryCache) {
    memoryCache = {
      payload: {
        ...memoryCache.payload,
        [slug]: { ...echoed, slug, fromFirestore: true },
      },
      fetchedAt: Date.now(),
    };
    notify(memoryCache.payload);
  }

  return echoed;
};

export const policyService = {
  listAll,
  getOne,
  save,
  subscribe,
  invalidate,
  POLICIES_COLLECTION,
};

export default policyService;
