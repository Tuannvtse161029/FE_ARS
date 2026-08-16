import type {
  RoleRequest,
  AccountItem,
  WithdrawalRequestItem,
  AnalyticsSummary,
  AnalyticsTimeSeries,
  AnalyticsRange,
  AnalyticsMetric,
} from '../types/admin';

// Internal copy of fixtures kept here so adminService.ts stays readable.
// Vietnamese-style names + bank names match the existing AdminWithdrawal page
// (which already uses vi-VN formatting). Each fixture has enough variety for
// the dashboard/accounts/transactions pages to render convincingly.

const NOW_ISO = '2026-08-16T10:30:00Z';
const daysAgo = (n: number) =>
  new Date(Date.UTC(2026, 7, 16) - n * 86_400_000).toISOString();

// ── Role requests ──────────────────────────────────────────────────────────
export const MOCK_ROLE_REQUESTS: RoleRequest[] = [
  {
    id: 1001,
    userId: 31,
    userName: 'Nguyen Van An',
    email: 'an.nguyen@hus.edu.vn',
    phone: '+84 901 234 567',
    affiliation: 'VNU University of Science',
    department: 'Faculty of Mathematics, Mechanics & Informatics',
    requestedRoles: ['REVIEWER'],
    proofDocumentUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/verification_docs%2Fmock-an-doicert.pdf?alt=media',
    submissionDate: daysAgo(1),
    status: 'PENDING',
  },
  {
    id: 1002,
    userId: 32,
    userName: 'Tran Thi Bich',
    email: 'bich.tran@hcmus.edu.vn',
    phone: '+84 902 345 678',
    affiliation: 'VNU-HCM University of Science',
    department: 'Department of Computer Science',
    requestedRoles: ['RESEARCHER', 'REVIEWER'],
    proofDocumentUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/verification_docs%2Fmock-bich-researchfocus.pdf?alt=media',
    submissionDate: daysAgo(2),
    status: 'PENDING',
  },
  {
    id: 1003,
    userId: 33,
    userName: 'Le Hoang Cuong',
    email: 'cuong.le@uit.edu.vn',
    phone: '+84 903 456 789',
    affiliation: 'University of Information Technology',
    department: 'Faculty of Computer Science',
    requestedRoles: ['LECTURER'],
    proofDocumentUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/verification_docs%2Fmock-cuong-license.pdf?alt=media',
    submissionDate: daysAgo(3),
    status: 'PENDING',
  },
  {
    id: 1004,
    userId: 34,
    userName: 'Pham Minh Duc',
    email: 'duc.pham@ftu.edu.vn',
    phone: '+84 904 567 890',
    affiliation: 'Foreign Trade University',
    department: 'Faculty of Business English',
    requestedRoles: ['RESEARCHER'],
    proofDocumentUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/verification_docs%2Fmock-duc-research.pdf?alt=media',
    submissionDate: daysAgo(5),
    status: 'APPROVED',
    notes: 'Verified by admin@example.com on ' + NOW_ISO,
  },
  {
    id: 1005,
    userId: 35,
    userName: 'Vu Thi Hong',
    email: 'hong.vu@academy.vn',
    phone: '+84 905 678 901',
    affiliation: 'Vietnam Academy of Science and Technology',
    department: 'Institute of Information Technology',
    requestedRoles: ['RESEARCHER'],
    proofDocumentUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/verification_docs%2Fmock-hong.pdf?alt=media',
    submissionDate: daysAgo(7),
    status: 'DENIED',
    notes: 'Document was a CV, not a research focus statement.',
  },
];

// ── Accounts ───────────────────────────────────────────────────────────────
export const MOCK_ACCOUNTS: AccountItem[] = [
  {
    id: 11,
    name: 'Nguyen Van An',
    email: 'an.nguyen@hus.edu.vn',
    roles: ['REVIEWER'],
    plan: 'PREMIUM',
    joinedDate: daysAgo(120),
    status: 'ACTIVE',
  },
  {
    id: 12,
    name: 'Tran Thi Bich',
    email: 'bich.tran@hcmus.edu.vn',
    roles: ['RESEARCHER', 'REVIEWER'],
    plan: 'PREMIUM',
    joinedDate: daysAgo(220),
    status: 'ACTIVE',
  },
  {
    id: 13,
    name: 'Le Hoang Cuong',
    email: 'cuong.le@uit.edu.vn',
    roles: ['LECTURER'],
    plan: 'FREE_TIER',
    joinedDate: daysAgo(60),
    status: 'ACTIVE',
  },
  {
    id: 14,
    name: 'Pham Minh Duc',
    email: 'duc.pham@ftu.edu.vn',
    roles: ['RESEARCHER'],
    plan: 'FREE_TIER',
    joinedDate: daysAgo(180),
    status: 'SUSPENDED',
    // Example: suspended 3 days ago for 14 days by a violation report.
    suspendedUntil: new Date(Date.UTC(2026, 7, 16) + 11 * 86_400_000).toISOString(),
  },
  {
    id: 15,
    name: 'Vu Thi Hong',
    email: 'hong.vu@academy.vn',
    roles: ['RESEARCHER'],
    plan: 'PREMIUM',
    joinedDate: daysAgo(365),
    status: 'ACTIVE',
  },
  {
    id: 16,
    name: 'Do Quang Khanh',
    email: 'khanh.do@hust.edu.vn',
    roles: ['GRADUATE_STUDENT'],
    plan: 'FREE_TIER',
    joinedDate: daysAgo(30),
    status: 'ACTIVE',
  },
  {
    id: 17,
    name: 'Bui Thi Linh',
    email: 'linh.bui@neu.edu.vn',
    roles: ['REVIEWER'],
    plan: 'FREE_TIER',
    joinedDate: daysAgo(95),
    status: 'ACTIVE',
  },
];

// ── Withdrawals (Figma 4–5) ────────────────────────────────────────────────
export const MOCK_WITHDRAWALS: WithdrawalRequestItem[] = [
  {
    txId: 2001,
    userId: 11,
    reviewerName: 'Nguyen Van An',
    amountVnd: 2_500_000,
    bankName: 'Vietcombank',
    accountNumber: '1029 7482 11',
    accountName: 'NGUYEN VAN AN',
    requestDate: daysAgo(1),
    status: 'PENDING',
    proofReceiptUrl: null,
  },
  {
    txId: 2002,
    userId: 12,
    reviewerName: 'Tran Thi Bich',
    amountVnd: 1_750_000,
    bankName: 'Techcombank',
    accountNumber: '1903 4500 22',
    accountName: 'TRAN THI BICH',
    requestDate: daysAgo(2),
    status: 'ACCEPTED_PROCESSING',
    proofReceiptUrl: null,
  },
  {
    txId: 2003,
    userId: 17,
    reviewerName: 'Bui Thi Linh',
    amountVnd: 4_200_000,
    bankName: 'BIDV',
    accountNumber: '5611 0099 33',
    accountName: 'BUI THI LINH',
    requestDate: daysAgo(4),
    status: 'COMPLETED',
    proofReceiptUrl:
      'https://firebasestorage.googleapis.com/v0/b/ars-platform-prod.appspot.com/o/withdrawal_receipts%2Fmock-linh-receipt.pdf?alt=media',
  },
  {
    txId: 2004,
    userId: 15,
    reviewerName: 'Vu Thi Hong',
    amountVnd: 950_000,
    bankName: 'ACB',
    accountNumber: '1234 5678 44',
    accountName: 'VU THI HONG',
    requestDate: daysAgo(6),
    status: 'DENIED',
    proofReceiptUrl: null,
    rejectionReason: 'Bank account name does not match registered KYC name.',
  },
];

// ── Analytics ─────────────────────────────────────────────────────────────
export const MOCK_ANALYTICS_SUMMARY: AnalyticsSummary = {
  totalMembers: 102_250,
  totalPapers: 4_120,
};

// Deterministic but plausible time series for each (range, metric) pair.
// The series are sized to match the pill: daily=30 points, weekly=12, monthly=12, yearly=10.
const REGISTRATION_DAILY: number[] = [
  12, 19, 9, 22, 31, 25, 17, 14, 28, 33, 21, 18, 11, 24, 27, 30, 22, 16, 13, 19,
  26, 29, 33, 38, 41, 36, 28, 24, 21, 17,
];
const REGISTRATION_WEEKLY: number[] = [
  140, 168, 195, 224, 207, 248, 281, 259, 302, 287, 318, 296,
];
const REGISTRATION_MONTHLY: number[] = [
  612, 745, 802, 938, 1050, 1196, 1324, 1480, 1612, 1754, 1893, 2042,
];
const REGISTRATION_YEARLY: number[] = [
  4350, 6420, 9120, 12_180, 14_970, 18_530, 22_410, 28_950, 36_240, 47_050,
];

const REVENUE_DAILY: number[] = [
  1_200_000, 1_540_000, 980_000, 2_120_000, 2_850_000, 2_240_000, 1_780_000,
  1_320_000, 2_410_000, 3_020_000, 1_910_000, 1_640_000, 1_120_000, 2_220_000,
  2_640_000, 2_960_000, 2_080_000, 1_510_000, 1_270_000, 1_780_000, 2_510_000,
  2_780_000, 3_130_000, 3_610_000, 3_950_000, 3_320_000, 2_640_000, 2_280_000,
  1_910_000, 1_540_000,
];
const REVENUE_WEEKLY: number[] = [
  12_400_000, 15_800_000, 18_200_000, 21_500_000, 19_100_000, 24_700_000,
  27_900_000, 25_400_000, 30_100_000, 28_300_000, 32_400_000, 29_700_000,
];
const REVENUE_MONTHLY: number[] = [
  58_400_000, 72_900_000, 78_200_000, 92_500_000, 104_000_000, 118_400_000,
  132_000_000, 148_500_000, 162_000_000, 174_900_000, 188_400_000, 204_800_000,
];
const REVENUE_YEARLY: number[] = [
  420_000_000, 612_000_000, 894_000_000, 1_220_000_000, 1_504_000_000,
  1_870_000_000, 2_265_000_000, 2_910_000_000, 3_650_000_000, 4_720_000_000,
];

function dateLabelsFor(range: AnalyticsRange): string[] {
  switch (range) {
    case 'daily': {
      const labels: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.UTC(2026, 7, 16) - i * 86_400_000);
        labels.push(d.toISOString().slice(0, 10));
      }
      return labels;
    }
    case 'weekly': {
      const labels: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(2026, 7, 16) - i * 7 * 86_400_000);
        labels.push(d.toISOString().slice(0, 10));
      }
      return labels;
    }
    case 'monthly': {
      const labels: string[] = [];
      const cursor = new Date(Date.UTC(2026, 7, 1));
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
        labels.push(d.toISOString().slice(0, 7));
      }
      return labels;
    }
    case 'yearly': {
      return ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    }
  }
}

function seriesFor(range: AnalyticsRange, metric: AnalyticsMetric): number[] {
  const table: Record<AnalyticsRange, Record<AnalyticsMetric, number[]>> = {
    daily: {
      user_registrations: REGISTRATION_DAILY,
      revenue: REVENUE_DAILY,
    },
    weekly: {
      user_registrations: REGISTRATION_WEEKLY,
      revenue: REVENUE_WEEKLY,
    },
    monthly: {
      user_registrations: REGISTRATION_MONTHLY,
      revenue: REVENUE_MONTHLY,
    },
    yearly: {
      user_registrations: REGISTRATION_YEARLY,
      revenue: REVENUE_YEARLY,
    },
  };
  return table[range][metric];
}

export function buildMockTimeseries(
  range: AnalyticsRange,
  metric: AnalyticsMetric,
): AnalyticsTimeSeries {
  const dates = dateLabelsFor(range);
  const values = seriesFor(range, metric);
  return {
    range,
    metric,
    points: dates.map((date, i) => ({ date, value: values[i] ?? 0 })),
  };
}
