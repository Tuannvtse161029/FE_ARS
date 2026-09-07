#!/usr/bin/env node
//
// scripts/sync-medal-icons.mjs
//
// One-shot CLI that re-syncs every medal icon in every metric family so
// the icon configured on the Admin Medals page is the icon that shows
// on the user's Profile / forum flair.
//
// What went wrong before this script existed
// ------------------------------------------
// `medalService.updateMedalFamilyIcon` calls `medalService.update` once
// per tier, sending PUT `/api/Medal/{id}` for each tier of the family.
// If one tier's PUT fails (e.g. a transient network error, or the BE
// silently rejects the imageUrl field for tiers other than the one
// admin clicked) the family ends up with mixed icons:
//   ORCID_VERIFIED_BRONZE = lucide:Award      (admin's new icon)
//   ORCID_VERIFIED_SILVER = lucide:ShieldCheck  (stale PUT)
// The Admin Medals page hides the drift because it loads the whole
// catalog and picks the canonical icon from the lowest-stage tier. The
// Profile page shows whatever the BE returns per-tier — and never asks
// "what's the canonical icon for this family?" — so Silver shows up
// with the old ShieldCheck icon forever.
//
// This script is the recovery path:
//   1. Reads the full medal catalog (GET /api/Medal).
//   2. Groups medals by metric family and picks the canonical icon from
//      the lowest-stage medal in each family.
//   3. PUTs that canonical icon onto every medal in the family so the
//      whole family shares one icon server-side.
//
// Usage
// -----
//   ARS_API_BASE_URL=https://arsplatform.onrender.com \
//   ARS_ADMIN_TOKEN=<bearer-token-from-an-admin-login> \
//   node scripts/sync-medal-icons.mjs
//
// Optional flags:
//   --dry-run        Read the catalog and print the planned updates
//                     without issuing any PUT.
//   --family=XYZ     Limit the sync to one metric family (e.g. --family=ORCID_VERIFIED).
//   --verbose        Log every per-medal PUT (success or failure).
//
// Exit codes
// ----------
//   0  — every targeted medal was updated (or --dry-run completed).
//   1  — at least one PUT failed; the script logs which one(s).
//   2  — catalog fetch failed; nothing was changed.
//

import process from 'node:process';

const API_BASE_URL =
  process.env.ARS_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'https://arsplatform.onrender.com';

const TOKEN =
  process.env.ARS_ADMIN_TOKEN ||
  process.env.ARS_TOKEN ||
  '';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run') || args.has('-n');
const verbose = args.has('--verbose') || args.has('-v');
const familyArg = [...args].find((a) => a.startsWith('--family='));
const onlyFamily = familyArg ? familyArg.slice('--family='.length).toUpperCase() : null;

if (!TOKEN) {
  console.error(
    '[sync-medal-icons] Missing bearer token. Set ARS_ADMIN_TOKEN (or ARS_TOKEN) env var.\n' +
      'Example:\n' +
      '  ARS_ADMIN_TOKEN=<bearer> node scripts/sync-medal-icons.mjs',
  );
  process.exit(2);
}

if (isDryRun) console.log('[sync-medal-icons] --dry-run: no PUTs will be sent.');

async function fetchJson(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GET ${path} → ${res.status} ${res.statusText}\n${body.slice(0, 500)}`,
    );
  }
  return res.json();
}

async function putJson(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PUT ${path} → ${res.status} ${res.statusText}\n${text.slice(0, 500)}`,
    );
  }
  // Some PUT endpoints return no body; fall back to the original.
  try {
    return await res.json();
  } catch {
    return body;
  }
}

/**
 * Derive the metric-family key from a medal code. Mirrors
 * `deriveMetricFamily` in `src/services/medal.service.ts` — keep these
 * two in sync if the BE adds new tier suffixes.
 */
function deriveFamily(code) {
  if (!code) return '';
  return String(code)
    .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
    .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '')
    .toUpperCase();
}

function groupByFamily(medals) {
  const buckets = new Map();
  for (const m of medals) {
    const family = deriveFamily(m.code);
    if (!family) continue;
    if (!buckets.has(family)) buckets.set(family, []);
    buckets.get(family).push(m);
  }
  return buckets;
}

async function main() {
  console.log(`[sync-medal-icons] Reading catalog from ${API_BASE_URL}/api/Medal …`);
  const catalog = await fetchJson('/api/Medal');
  if (!Array.isArray(catalog)) {
    throw new Error(`Expected an array from GET /api/Medal, got ${typeof catalog}`);
  }
  console.log(`[sync-medal-icons] Catalog returned ${catalog.length} medals.`);

  const families = groupByFamily(catalog);
  const targets = [];
  for (const [family, members] of families.entries()) {
    if (onlyFamily && family !== onlyFamily) continue;
    const sorted = [...members].sort(
      (a, b) => (a.stageLevel ?? 0) - (b.stageLevel ?? 0),
    );
    const canonical = sorted[0]?.imageUrl ?? 'lucide:Medal';
    for (const m of sorted) {
      if (m.imageUrl !== canonical) {
        targets.push({ medal: m, family, canonicalIcon: canonical });
      }
    }
  }

  if (targets.length === 0) {
    console.log(
      onlyFamily
        ? `[sync-medal-icons] Family ${onlyFamily} is already in sync (${families.get(onlyFamily)?.length ?? 0} tiers).`
        : '[sync-medal-icons] Catalog is already in sync — no PUTs needed.',
    );
    return;
  }

  console.log(
    `[sync-medal-icons] Plan: ${targets.length} PUT(s) across ${
      new Set(targets.map((t) => t.family)).size
    } family(ies).`,
  );
  for (const t of targets) {
    console.log(
      `  · ${t.family} · ${t.medal.code} (${t.medal.tier}, stage ${t.medal.stageLevel}) → ${t.canonicalIcon}`,
    );
  }

  if (isDryRun) {
    console.log('[sync-medal-icons] --dry-run: skipping PUTs.');
    return;
  }

  let ok = 0;
  let failed = 0;
  const failures = [];
  for (const t of targets) {
    const url = `/api/Medal/${t.medal.id}`;
    const body = { imageUrl: t.canonicalIcon };
    try {
      await putJson(url, body);
      ok += 1;
      if (verbose) console.log(`  ✓ PUT ${url} (${t.medal.code}) → ${t.canonicalIcon}`);
    } catch (err) {
      failed += 1;
      failures.push({ medal: t.medal.code, error: err.message });
      console.error(`  ✗ PUT ${url} (${t.medal.code}) → ${err.message}`);
    }
  }

  console.log(
    `[sync-medal-icons] Done. ${ok} updated, ${failed} failed${onlyFamily ? ` (family ${onlyFamily})` : ''}.`,
  );
  if (failed > 0) {
    console.error('[sync-medal-icons] Failures:');
    for (const f of failures) {
      console.error(`  - ${f.medal}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[sync-medal-icons] Aborted: ${err.message}`);
  process.exit(2);
});
