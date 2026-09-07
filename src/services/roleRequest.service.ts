import api from './axios';
import type { RequestableRole } from '../utils/registrationRoles';
import type { RoleRequest } from '../types/admin';

export interface SubmitAdditionalRoleRequestInput {
  userId: number;
  userName: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  affiliation?: string;
  department?: string;
  currentRoles: string[];
  requestedAdditionalRole: RequestableRole;
  reason?: string;
  proofDocumentUrl?: string;
  orcidId?: string;
}

export interface UserPendingRoleRequest {
  id?: number;
  userId: number;
  userName: string;
  email: string;
  phone?: string;
  affiliation?: string;
  department?: string;
  currentRoles: string[];
  requestedRole: RequestableRole;
  reason?: string;
  proofDocumentUrl?: string;
  orcidId?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  submittedAt: string;
}

/**
 * Backend CreateAdditionalRoleRequest contract:
 * Note: backend specifies "additionalProperties: false",
 * so DO NOT add properties not defined in the backend schema.
 */
interface CreateAdditionalRoleRequestPayload {
  userId: number;
  requestedRole: string;
  proofDocumentUrl: string;
  requestType?: string;
  affiliation?: string;
  department?: string;
  phoneNumber?: string;
  orcidId?: string | null;
  reason?: string;
}

const STORAGE_KEY_PREFIX = 'ars_user_additional_role_request_';

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export const roleRequestService = {
  /**
   * Submit an additional role request.
   * Calls the backend API with the exact CreateAdditionalRoleRequest payload.
   */
  async submit(input: SubmitAdditionalRoleRequestInput): Promise<UserPendingRoleRequest> {
    const payload: CreateAdditionalRoleRequestPayload = {
      userId: input.userId,
      requestedRole: input.requestedAdditionalRole,
      proofDocumentUrl: input.proofDocumentUrl || '',
      requestType: 'ADDITIONAL_ROLE',
      affiliation: input.affiliation || '',
      department: input.department || '',
      phoneNumber: input.phoneNumber || input.phone || '',
      orcidId: input.orcidId || null,
      reason: input.reason || '',
    };

    let requestId: number | undefined;

    try {
      // POST /api/RoleRequest or /api/RoleRequest/additional-role
      const response = await api.post<RoleRequest>('/api/RoleRequest', payload);
      if (response.data && response.data.id) {
        requestId = response.data.id;
      }
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        (typeof err?.response?.data === 'string' ? err?.response?.data : null);

      if (err?.response?.status === 400 || err?.response?.status === 409) {
        throw new Error(
          serverMsg || 'Yêu cầu không hợp lệ hoặc bạn đang có yêu cầu chờ xét duyệt.',
        );
      }

      // If network or transient error, keep local timestamp as id
      requestId = Date.now();
    }

    const record: UserPendingRoleRequest = {
      id: requestId,
      userId: input.userId,
      userName: input.userName,
      email: input.email,
      phone: input.phone || input.phoneNumber,
      affiliation: input.affiliation,
      department: input.department,
      currentRoles: input.currentRoles,
      requestedRole: input.requestedAdditionalRole,
      reason: input.reason,
      proofDocumentUrl: input.proofDocumentUrl,
      orcidId: input.orcidId,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(getStorageKey(input.userId), JSON.stringify(record));
      } catch {
        // ignore storage quota errors
      }
    }

    return record;
  },

  /**
   * Fast synchronous check from local storage.
   */
  getPendingRequest(userId: number): UserPendingRoleRequest | null {
    if (typeof window === 'undefined' || !userId) return null;
    try {
      const raw = localStorage.getItem(getStorageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UserPendingRoleRequest;
      if (parsed && parsed.status === 'PENDING') {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  },

  /**
   * Live check against backend API endpoint: GET /api/RoleRequest/user/{userId}/pending
   * Syncs with local storage.
   */
  async fetchPendingRequest(userId: number): Promise<UserPendingRoleRequest | null> {
    if (!userId) return null;
    try {
      const response = await api.get<any>(`/api/RoleRequest/user/${userId}/pending`);
      if (response.status === 204 || !response.data) {
        // No content -> no pending request in BE
        this.clearPendingRequest(userId);
        return null;
      }

      const item = response.data;
      const requestedRole = (
        item.requestedRole ||
        item.requestedAdditionalRoles?.[0] ||
        item.requestedRoles?.[0] ||
        'Reviewer'
      ) as RequestableRole;

      const record: UserPendingRoleRequest = {
        id: item.id,
        userId: item.userId ?? userId,
        userName: item.userName || '',
        email: item.email || '',
        phone: item.phone || item.phoneNumber,
        affiliation: item.affiliation,
        department: item.department,
        currentRoles: item.currentRoles || [],
        requestedRole,
        reason: item.reason || item.notes,
        proofDocumentUrl: item.proofDocumentUrl,
        orcidId: item.orcidId,
        status: 'PENDING',
        submittedAt: item.submissionDate || new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(record));
      }
      return record;
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        this.clearPendingRequest(userId);
        return null;
      }
      // If endpoint is unreachable, fallback to local storage
      return this.getPendingRequest(userId);
    }
  },

  /**
   * Dismiss or cancel a pending request.
   */
  async cancelPendingRequest(userId: number, requestId?: number): Promise<void> {
    if (requestId) {
      try {
        await api.post(`/api/RoleRequest/${requestId}/cancel`);
      } catch {
        try {
          await api.delete(`/api/RoleRequest/${requestId}`);
        } catch {
          // ignore backend cancel errors
        }
      }
    }
    this.clearPendingRequest(userId);
  },

  /**
   * Remove from local storage.
   */
  clearPendingRequest(userId: number): void {
    if (typeof window === 'undefined' || !userId) return;
    try {
      localStorage.removeItem(getStorageKey(userId));
    } catch {
      // ignore
    }
  },
};

export default roleRequestService;
