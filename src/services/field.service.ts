import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { MajorField, SubField, MajorFieldCreateRequest, SubFieldCreateRequest } from '../types/domain';

export const fieldService = {
  getAllMajor: async (): Promise<MajorField[]> => {
    const response = await api.get<MajorField[]>(API_ENDPOINTS.MAJOR_FIELD.GET_ALL);
    return Array.isArray(response.data) ? response.data : [];
  },

  createMajor: async (data: MajorFieldCreateRequest): Promise<MajorField> => {
    const response = await api.post<MajorField>(API_ENDPOINTS.MAJOR_FIELD.CREATE, data);
    return response.data;
  },

  getAllSub: async (majorFieldId?: number): Promise<SubField[]> => {
    const params = majorFieldId !== undefined ? { majorFieldId } : undefined;
    const response = await api.get<SubField[]>(API_ENDPOINTS.SUB_FIELD.GET_ALL, { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  createSub: async (data: SubFieldCreateRequest): Promise<SubField> => {
    const response = await api.post<SubField>(API_ENDPOINTS.SUB_FIELD.CREATE, data);
    return response.data;
  },
};
