import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { AppConfig } from '../config/app';

// ── Centralized withdrawal feature gate ──────────────────────────────────────
// When AppConfig.features.enableWithdrawals is `false`, every withdrawal
// service call short-circuits with `WithdrawalFeatureDisabledError` so stale
// or partially-rendered UI cannot trigger BE withdrawal endpoints. The
// underlying axios calls remain defined and untouched — re-enabling the flag
// restores them with no other code changes required.

export class WithdrawalFeatureDisabledError extends Error {
  constructor() {
    super('Withdrawal requests are temporarily unavailable. The feature has been disabled pending product review.');
    this.name = 'WithdrawalFeatureDisabledError';
  }
}

export const isWithdrawalFeatureEnabled = (): boolean =>
  AppConfig.features.enableWithdrawals === true;

const guardWithdrawalCall = (method: string) => {
  if (!isWithdrawalFeatureEnabled()) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[withdrawalService] ${method} blocked: withdrawal feature is disabled.`);
    }
    throw new WithdrawalFeatureDisabledError();
  }
};

// Mirrors BE WithdrawalRequest entity:
// WithdrawalRequestId (PK), UserId (FK), WalletId (FK), BankName, AccountNumber,
// AccountName, Amount, Status, Note, RejectionReason, CreatedAt, UpdatedAt
export interface WithdrawalRequest {
  id?: number;          // normalized: withdrawalRequestId → id
  withdrawalRequestId?: number;
  userId?: number | null;
  walletId?: number | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  amount?: number | null;
  status?: string | null;
  note?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WithdrawalRequestCreateRequest {
  userId?: number;
  walletId?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  note?: string;
}

export interface WithdrawalStatusUpdateRequest {
  status: 'Approved' | 'Rejected';
  reviewerId?: number;
  rejectionReason?: string;
}

export const withdrawalService = {
  // GET /api/WithdrawalRequest — returns raw array
  getAll: async (): Promise<WithdrawalRequest[]> => {
    guardWithdrawalCall('getAll');
    const response = await api.get<WithdrawalRequest[]>(API_ENDPOINTS.WITHDRAWAL_REQUEST.GET_ALL);
    const raw: unknown[] = Array.isArray(response.data) ? response.data : [];
    return (raw as WithdrawalRequest[]).map((item) => ({
      ...item,
      id: item.withdrawalRequestId ?? item.id,
    }));
  },

  getById: async (id: number): Promise<WithdrawalRequest> => {
    guardWithdrawalCall('getById');
    const response = await api.get<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.GET_BY_ID(id)
    );
    return {
      ...response.data,
      id: response.data.withdrawalRequestId ?? response.data.id,
    };
  },

  // POST /api/WithdrawalRequest — creates a new request (Status defaults to Pending on BE)
  create: async (data: WithdrawalRequestCreateRequest): Promise<WithdrawalRequest> => {
    guardWithdrawalCall('create');
    const response = await api.post<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.CREATE,
      data
    );
    return {
      ...response.data,
      id: response.data.withdrawalRequestId ?? response.data.id,
    };
  },

  // PUT /api/WithdrawalRequest/{id} — admin: approve or reject
  updateStatus: async (
    id: number,
    data: WithdrawalStatusUpdateRequest
  ): Promise<WithdrawalRequest> => {
    guardWithdrawalCall('updateStatus');
    const response = await api.put<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.UPDATE(id),
      data
    );
    return response.data;
  },

  // Generic partial update (e.g. for future use)
  update: async (
    id: number,
    data: Partial<WithdrawalRequest>
  ): Promise<WithdrawalRequest> => {
    guardWithdrawalCall('update');
    const response = await api.put<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.UPDATE(id),
      data
    );
    return response.data;
  },
};

export default withdrawalService;
