import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

// Mirrors BE WithdrawalRequest shape.
// Field names should be cross-checked against the Swagger docs at
// https://arsplatform.onrender.com/swagger/index.html before shipping.
export interface WithdrawalRequest {
  id?: number;
  withdrawalRequestId?: number;
  reviewerId?: number | null;
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
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  note?: string;
}

export const withdrawalService = {
  getAll: async (): Promise<WithdrawalRequest[]> => {
    const response = await api.get<WithdrawalRequest[]>(API_ENDPOINTS.WITHDRAWAL_REQUEST.GET_ALL);
    const raw: unknown[] = Array.isArray(response.data) ? response.data : [];
    // Normalize BE field name `withdrawalRequestId` → `id`
    return (raw as WithdrawalRequest[]).map((item) => ({
      ...item,
      id: item.withdrawalRequestId ?? item.id,
    }));
  },

  getById: async (id: number): Promise<WithdrawalRequest> => {
    const response = await api.get<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.GET_BY_ID(id)
    );
    return response.data;
  },

  create: async (data: WithdrawalRequestCreateRequest): Promise<WithdrawalRequest> => {
    const response = await api.post<WithdrawalRequest>(
      API_ENDPOINTS.WITHDRAWAL_REQUEST.CREATE,
      data
    );
    return response.data;
  },
};

export default withdrawalService;
