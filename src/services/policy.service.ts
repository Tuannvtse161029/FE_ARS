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
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '../firebase';
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
      return 'Firestore is unreachable. Check your network connection and try again.';
    case 'failed-precondition':
      return 'Firestore rejected the write — the policies collection may not exist yet. Create it in the Firebase Console.';
    default:
      return (error as Error)?.message ?? String(error);
  }
};

const slugDoc = (slug: PolicySlug) => doc(firestore!, POLICIES_COLLECTION, slug);

const slugCollection = () => collection(firestore!, POLICIES_COLLECTION);

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

export const listAll = async (): Promise<Record<PolicySlug, PolicySnapshot>> => {
  if (!isFirebaseConfigured() || !firestore) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to your .env file.',
    );
  }

  let snap;
  try {
    snap = await getDocs(slugCollection());
  } catch (error) {
    throw new Error(describeError(error));
  }

  const byId = new Map<string, Record<string, unknown>>();
  snap.forEach((docSnap) => {
    byId.set(docSnap.id, docSnap.data() as Record<string, unknown>);
  });

  const out = {} as Record<PolicySlug, PolicySnapshot>;
  for (const slug of POLICY_SLUGS) {
    const data = byId.get(slug);
    const doc = fromSnapshot(slug, data);
    out[slug] = {
      ...doc,
      slug,
      fromFirestore: Boolean(data),
    };
  }
  return out;
};

/**
 * Fetch a single policy. Returns the seed default when the document has
 * never been written to Firestore.
 */
export const getOne = async (slug: PolicySlug): Promise<PolicySnapshot> => {
  if (!isFirebaseConfigured() || !firestore) {
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to your .env file.',
    );
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
    throw new Error(
      'Firebase is not configured. Add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to your .env file.',
    );
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
  return {
    title: meta.title,
    content,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.name ?? 'Admin',
  };
};

export const policyService = {
  listAll,
  getOne,
  save,
  POLICIES_COLLECTION,
};

export default policyService;
