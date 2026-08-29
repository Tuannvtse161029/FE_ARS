import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  AnnualFeeDto,
  AnnualFeeCreateRequest,
  AnnualFeeUpdateRequest,
  AnnualFeeFilterParams,
} from '../types/annualFee';

const normalizeAnnualFee = (raw: unknown): AnnualFeeDto => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === 'number' ? r.id : Number(r.id) || 0;
  return {
    id,
    targetRole: typeof r.targetRole === 'string' ? r.targetRole : 'Researcher',
    title: typeof r.title === 'string' ? r.title : `Fee Tier #${id}`,
    priceVnd: typeof r.priceVnd === 'number' ? r.priceVnd : Number(r.priceVnd) || 0,
    billingCycle: typeof r.billingCycle === 'string' ? r.billingCycle : 'Annual',
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    isActive: Boolean(r.isActive),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
  };
};

const normalizeAnnualFeeList = (raw: unknown): AnnualFeeDto[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAnnualFee).filter((f) => f.id > 0);
};

export const annualFeeService = {
  listAnnualFees: async (params?: AnnualFeeFilterParams): Promise<AnnualFeeDto[]> => {
    const response = await api.get<AnnualFeeDto[]>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_ALL,
      { params },
    );
    return normalizeAnnualFeeList(response.data);
  },

  getAnnualFee: async (id: number): Promise<AnnualFeeDto> => {
    const response = await api.get<AnnualFeeDto>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_BY_ID(id),
    );
    return normalizeAnnualFee(response.data);
  },

  createAnnualFee: async (
    payload: AnnualFeeCreateRequest,
  ): Promise<AnnualFeeDto> => {
    const response = await api.post<AnnualFeeDto>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.CREATE,
      payload,
    );
    return normalizeAnnualFee(response.data);
  },

  updateAnnualFee: async (
    id: number,
    payload: AnnualFeeUpdateRequest,
  ): Promise<AnnualFeeDto> => {
    const response = await api.put<AnnualFeeDto>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.UPDATE(id),
      payload,
    );
    return normalizeAnnualFee(response.data);
  },

  toggleAnnualFee: async (id: number): Promise<AnnualFeeDto> => {
    const response = await api.patch<AnnualFeeDto>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.TOGGLE(id),
    );
    return normalizeAnnualFee(response.data);
  },

  deleteAnnualFee: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.ADMIN.ANNUAL_FEES.DELETE(id));
  },
};

export default annualFeeService;