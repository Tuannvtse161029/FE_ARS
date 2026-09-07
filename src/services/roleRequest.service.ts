import api from './axios';
import type { RequestableRole } from '../utils/registrationRoles';
import type { RoleRequest } from '../types/admin';

export interface SubmitAdditionalRoleRequestInput {
  userId: number;
  userName: string;
  email: string;
  phone?: string;
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

const STORAGE_KEY_PREFIX = 'ars_user_additional_role_request_';

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export const roleRequestService = {
  /**
   * Submit an additional role request.
   * Calls the backend API and stores local state for responsive UI.
   */
  async submit(input: SubmitAdditionalRoleRequestInput): Promise<UserPendingRoleRequest> {
    const payload = {
      userId: input.userId,
      userName: input.userName,
      email: input.email,
      phone: input.phone || '',
      affiliation: input.affiliation || '',
      department: input.department || '',
      currentRoles: input.currentRoles,
      requestedAdditionalRoles: [input.requestedAdditionalRole],
      requestType: 'ADDITIONAL_ROLE',
      requestedRoles: [input.requestedAdditionalRole],
      proofDocumentUrl: input.proofDocumentUrl || '',
      notes: input.reason || '',
      orcidId: input.orcidId || null,
    };

    let requestId: number | undefined;

    try {
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
        throw new Error(serverMsg || 'Yêu cầu không hợp lệ hoặc bạn đã có yêu cầu đang chờ duyệt.');
      }

      // If endpoint is not yet accepting POST or returns 404/500, fallback to local persistence
      requestId = Date.now();
    }

    const record: UserPendingRoleRequest = {
      id: requestId,
      userId: input.userId,
      userName: input.userName,
      email: input.email,
      phone: input.phone,
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
        // ignore localStorage quota errors
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
   * Live check against backend API, syncing local cache.
   */
  async fetchPendingRequest(userId: number): Promise<UserPendingRoleRequest | null> {
    if (!userId) return null;
    try {
      const response = await api.get<any[]>('/api/RoleRequest');
      const items = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.items || [];

      // Find requests for this user
      const userRequests = items.filter((r: any) => r.userId === userId);
      const pending = userRequests.find((r: any) => {
        const s = String(r.status || '').toUpperCase();
        return s === 'PENDING';
      });

      if (pending) {
        const requestedRole = (
          pending.requestedAdditionalRoles?.[0] ||
          pending.requestedRoles?.[0] ||
          'Reviewer'
        ) as RequestableRole;

        const record: UserPendingRoleRequest = {
          id: pending.id,
          userId: pending.userId,
          userName: pending.userName || '',
          email: pending.email || '',
          phone: pending.phone,
          affiliation: pending.affiliation,
          department: pending.department,
          currentRoles: pending.currentRoles || [],
          requestedRole,
          reason: pending.notes,
          proofDocumentUrl: pending.proofDocumentUrl,
          orcidId: pending.orcidId,
          status: 'PENDING',
          submittedAt: pending.submissionDate || new Date().toISOString(),
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(getStorageKey(userId), JSON.stringify(record));
        }
        return record;
      }

      // If user has no pending request in BE, clear any stale local state
      this.clearPendingRequest(userId);
      return null;
    } catch {
      // If live endpoint is protected or unavailable, fall back to local storage
      return this.getPendingRequest(userId);
    }
  },

  /**
   * Dismiss or cancel a pending request.
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
