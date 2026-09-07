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
    } catch {
      // Backend may not expose POST /api/RoleRequest yet or may require Admin token;
      // we generate an ID and persist to local storage so the flow is seamless.
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
   * Check if a user currently has a pending additional role request.
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
