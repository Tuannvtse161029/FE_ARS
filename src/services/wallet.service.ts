import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { Wallet, WalletCreateRequest } from '../types/domain';

export const walletService = {
  getAll: async (userId?: number): Promise<Wallet[]> => {
    const params = userId !== undefined ? { userId } : undefined;
    const response = await api.get<Wallet[]>(API_ENDPOINTS.WALLET.GET_ALL, { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (id: number): Promise<Wallet> => {
    const response = await api.get<Wallet>(API_ENDPOINTS.WALLET.GET_BY_ID(id));
    return response.data;
  },

  // DEV-ONLY: instant wallet top-up bypassing the PayOS redirect flow. Only
  // callable from WalletTopUpModal which gates the UI behind
  // `import.meta.env.DEV`. Production builds never expose this codepath.
  autoFund: async (payload: WalletCreateRequest): Promise<Wallet> => {
    const response = await api.post<Wallet>(API_ENDPOINTS.WALLET.AUTO_FUND, payload);
    return response.data;
  },
};
