import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  GroupJoinRequestResponse,
  CreateGroupJoinRequestResponse,
  AcceptGroupJoinRequestResponse,
  RejectGroupJoinRequestResponse,
  GroupJoinRequestStatus,
} from '../types/researchWorkflowDtos';

export const groupJoinRequestService = {
  /**
   * Graduate Student submits a join request for a research group.
   * POST /api/ResearchGroup/{groupId}/join-requests
   */
  applyToGroup: async (groupId: number): Promise<CreateGroupJoinRequestResponse> => {
    const response = await api.post<CreateGroupJoinRequestResponse>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP_JOIN_REQUEST.STUDENT_CREATE(groupId),
    );
    return response.data;
  },

  /**
   * Lecturer retrieves join requests filtered by status (default PENDING).
   * GET /api/lecturer/research-groups/{groupId}/join-requests?status=PENDING
   */
  getRequestsByGroup: async (
    groupId: number,
    status: GroupJoinRequestStatus = 'PENDING',
  ): Promise<GroupJoinRequestResponse[]> => {
    const response = await api.get<GroupJoinRequestResponse[]>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP_JOIN_REQUEST.LECTURER_LIST(groupId, status),
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Lecturer retrieves single join request details.
   * GET /api/lecturer/research-groups/{groupId}/join-requests/{requestId}
   */
  getRequestById: async (
    groupId: number,
    requestId: number,
  ): Promise<GroupJoinRequestResponse> => {
    const response = await api.get<GroupJoinRequestResponse>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP_JOIN_REQUEST.LECTURER_DETAIL(groupId, requestId),
    );
    return response.data;
  },

  /**
   * Lecturer accepts a pending join request.
   * POST /api/lecturer/research-groups/{groupId}/join-requests/{requestId}/accept
   */
  acceptRequest: async (
    groupId: number,
    requestId: number,
  ): Promise<AcceptGroupJoinRequestResponse> => {
    const response = await api.post<AcceptGroupJoinRequestResponse>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP_JOIN_REQUEST.LECTURER_ACCEPT(groupId, requestId),
    );
    return response.data;
  },

  /**
   * Lecturer rejects a pending join request with optional note.
   * POST /api/lecturer/research-groups/{groupId}/join-requests/{requestId}/reject
   */
  rejectRequest: async (
    groupId: number,
    requestId: number,
    rejectionNote?: string,
  ): Promise<RejectGroupJoinRequestResponse> => {
    const response = await api.post<RejectGroupJoinRequestResponse>(
      API_ENDPOINTS.RESEARCH_WORKFLOW.RESEARCH_GROUP_JOIN_REQUEST.LECTURER_REJECT(groupId, requestId),
      { rejectionNote: rejectionNote?.trim() || undefined },
    );
    return response.data;
  },
};

export default groupJoinRequestService;
