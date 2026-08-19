import api from './axios';
import { REPORT } from '../utils/constants';

export type ReportTargetType = 'ForumPost' | 'ForumComment';

export interface ReportCreateRequest {
  reporterId: number;
  targetType: ReportTargetType;
  targetId: number;
  reason: string;
  violationNotes?: string;
}

export interface Report {
  id: number;
  reporterId: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  violationNotes?: string;
  createdAt: string;
}

export const reportService = {
  createReport: async (data: ReportCreateRequest): Promise<Report> => {
    const response = await api.post<Report>(REPORT.CREATE, data);
    return response.data;
  },

  getReports: async (): Promise<Report[]> => {
    const response = await api.get<Report[]>(REPORT.GET_ALL);
    return response.data ?? [];
  },
};

export default reportService;
