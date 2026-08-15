import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

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
    const response = await api.get<WithdrawalRequest[]>(API_ENDPOINTS.WITHDRAWAL_REQUEST.GET_ALL);
    const raw: unknown[] = Array.isArray(response.data) ? response.data : [];
    return (raw as WithdrawalRequest[]).map((item) => ({
      ...item,
      id: item.withdrawalRequestId ?? item.id,
    }));
  },

  getById: async (id: number): Promise<WithdrawalRequest> => {
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
    const response = await api.put<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.UPDATE(id),
      data
    );
    return response.data;
  },
};

export default withdrawalService;
