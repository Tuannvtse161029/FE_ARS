/**
 * One-off script: grant every default medal (all 26) to each test account so the
 * Admin / Reviewer / Researcher / Graduate Student profile layouts can be
 * visually verified end-to-end.
 *
 *   node scripts/grant-all-medals-to-test-users.mjs
 *
 * Requires the Render API to be reachable. Uses the Admin token to call
 * POST /api/Medal/grant — we DO NOT log in as each user; the grant endpoint is
 * admin-scoped and idempotent per (userId, medalCode).
 */

const API_BASE = process.env.VITE_API_BASE_URL || 'https://arsplatform.onrender.com';

const ADMIN = { email: 'admin@arsplatform.com', password: 'Admin@123' };

const TEST_USERS = [
  { role: 'reviewer',     email: 'reviewer@arsplatform.com',   password: 'Password123!' },
  { role: 'researcher',   email: 'researcher@arsplatform.com', password: 'Password123!' },
  { role: 'lecturer',     email: 'lecturer@arsplatform.com',   password: 'Password123!' },
  { role: 'g.student',    email: 'gradstudent@arsplatform.com',password: 'Password123!' },
];

// All 26 default medal codes (Bronze/Silver/Gold/Platinum tiers) — kept in sync
// with INITIAL_MEDALS in src/services/medal.service.ts.
const MEDAL_CODES = [
  'ORCID_VERIFIED_BRONZE',
  'ORCID_VERIFIED_SILVER',
  'ORCID_VERIFIED_GOLD',
  'PROLIFIC_AUTHOR_BRONZE',
  'PROLIFIC_AUTHOR_SILVER',
  'PROLIFIC_AUTHOR_GOLD',
  'PROLIFIC_AUTHOR_PLATINUM',
  'ACADEMIC_HOST_BRONZE',
  'ACADEMIC_HOST_SILVER',
  'ACADEMIC_HOST_GOLD',
  'ACADEMIC_HOST_PLATINUM',
  'MASTER_MENTOR_BRONZE',
  'MASTER_MENTOR_SILVER',
  'MASTER_MENTOR_GOLD',
  'MASTER_MENTOR_PLATINUM',
  'REVIEW_MILESTONE_I',
  'REVIEW_MILESTONE_II',
  'REVIEW_MILESTONE_III',
  'REVIEW_MILESTONE_IV',
  'SEMINAR_PARTICIPANT_BRONZE',
  'SEMINAR_PARTICIPANT_SILVER',
  'SEMINAR_PARTICIPANT_GOLD',
  'SEMINAR_PARTICIPANT_PLATINUM',
  'FLAWLESS_PROGRESS_BRONZE',
  'FLAWLESS_PROGRESS_SILVER',
  'FLAWLESS_PROGRESS_GOLD',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, path, { token, body } = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, data: json };
}

async function loginAs(email, password) {
  const res = await http('POST', '/api/auth/login', { body: { email, password } });
  if (!res.ok) throw new Error(`login(${email}) failed: ${res.status} ${JSON.stringify(res.data)}`);
  const token = res.data?.token || res.data?.accessToken || res.data?.jwt;
  const userId = res.data?.userId ?? res.data?.user?.userId ?? res.data?.user?.id ?? res.data?.id;
  if (!token) throw new Error(`login(${email}) returned no token: ${JSON.stringify(res.data)}`);
  return { token, userId, raw: res.data };
}

async function grantMedal(token, userId, medalCode, forceUnlocked = true) {
  return http('POST', '/api/Medal/grant', {
    token,
    body: {
      userId: Number(userId),
      medalCode,
      forceUnlocked,
      awardedReason: 'Bulk grant for layout testing',
    },
  });
}

async function verifyUserMedals(token, userId) {
  const res = await http('GET', `/api/Medal/user/${userId}?includeLocked=true`, { token });
  if (!res.ok) return { ok: false, status: res.status, unlocked: 0, total: 0 };
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    ok: true,
    status: res.status,
    unlocked: list.filter((m) => m?.isUnlocked).length,
    total: list.length,
  };
}

(async () => {
  console.log(`▶ Using API base: ${API_BASE}`);
  console.log(`▶ Logging in as admin (${ADMIN.email}) …`);
  const admin = await loginAs(ADMIN.email, ADMIN.password);
  console.log(`  ✓ admin token acquired (userId=${admin.userId})`);

  for (const u of TEST_USERS) {
    console.log(`\n=== ${u.role} (${u.email}) ===`);
    console.log(`  · logging in to read userId …`);
    let userSession;
    try {
      userSession = await loginAs(u.email, u.password);
    } catch (err) {
      console.log(`  ✗ login failed: ${err.message}`);
      continue;
    }
    const userId = userSession.userId;
    console.log(`  · userId = ${userId}`);

    let okCount = 0;
    let failCount = 0;
    const failedCodes = [];

    for (const code of MEDAL_CODES) {
      const res = await grantMedal(admin.token, userId, code, true);
      if (res.ok || res.status === 201) {
        okCount += 1;
      } else if (
        res.status === 409 ||
        (res.data && typeof res.data === 'string' && /already/i.test(res.data))
      ) {
        // Already granted — count as OK for the test setup.
        okCount += 1;
      } else {
        failCount += 1;
        failedCodes.push(`${code} → ${res.status} ${JSON.stringify(res.data)}`);
      }
      // Tiny throttle so we don't hammer the BE.
      await sleep(40);
    }
    console.log(`  ✓ granted: ${okCount}/${MEDAL_CODES.length} (failures: ${failCount})`);
    if (failedCodes.length) {
      console.log(`  ! failed codes:`);
      for (const f of failedCodes) console.log(`      - ${f}`);
    }

    // Verify by reading user medals back.
    const verify = await verifyUserMedals(admin.token, userId);
    if (verify.ok) {
      console.log(`  ↳ GET /api/Medal/user/${userId}: ${verify.unlocked} unlocked / ${verify.total} total entries`);
    } else {
      console.log(`  ↳ verification fetch failed: ${verify.status}`);
    }
  }

  console.log('\n✔ Done. Profile pages for each role should now show the full medal grid.');
  console.log('  Login URLs:');
  for (const u of TEST_USERS) {
    console.log(`    ${u.role.padEnd(11)} → ${u.email} / ${u.password}`);
  }
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
