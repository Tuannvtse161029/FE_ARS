import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { AnnualFeeDto, AnnualFeeUpsertRequest } from '../types/annualFee';

export class AnnualFeeBackendUnavailableError extends Error {
  constructor() {
    super('Annual fee API is unavailable.');
    this.name = 'AnnualFeeBackendUnavailableError';
  }
}

export const annualFeeService = {
  listAnnualFees: async (): Promise<AnnualFeeDto[]> => {
    const response = await api.get<AnnualFeeDto[]>(API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_ALL);
    return response.data ?? [];
  },
  createAnnualFee: async (data: AnnualFeeUpsertRequest): Promise<AnnualFeeDto> => {
    const response = await api.post<AnnualFeeDto>(API_ENDPOINTS.ADMIN.ANNUAL_FEES.CREATE, data);
    return response.data;
  },
  toggleAnnualFee: async (id: number): Promise<AnnualFeeDto> => {
    const response = await api.patch<AnnualFeeDto>(API_ENDPOINTS.ADMIN.ANNUAL_FEES.TOGGLE(id));
    return response.data;
  },
  deleteAnnualFee: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.ADMIN.ANNUAL_FEES.DELETE(id));
  },
  getAnnualFee: async (id: number): Promise<AnnualFeeDto | null> => {
    const response = await api.get<AnnualFeeDto>(API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_BY_ID(id));
    return response.data ?? null;
  },
};

export default annualFeeService;
