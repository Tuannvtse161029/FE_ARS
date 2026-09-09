/**
 * Annual Fee service.
 *
 * Handles annual fee management for researchers and lecturers on the platform.
 * API endpoints (pending BE implementation):
 *   GET    /api/AnnualFee              — List all active fee plans
 *   GET    /api/AnnualFee/{id}        — Get a specific fee plan
 *   POST   /api/AnnualFee              — Admin: create fee plan
 *   PUT    /api/AnnualFee/{id}        — Admin: update fee plan
 *   DELETE /api/AnnualFee/{id}       — Admin: delete fee plan
 *   POST   /api/AnnualFee/{id}/purchase — User: purchase (creates PayOS link)
 *   GET    /api/AnnualFee/my-purchases — User: purchase history
 *   GET    /api/AnnualFee/my-current    — User: current active subscription
 */
import type {
  AnnualFee,
  AnnualFeeUpsertRequest,
  AnnualFeePurchase,
  AnnualFeePurchaseRequest,
  AnnualFeePurchaseResponse,
  CurrentAnnualFeeSubscription,
} from '../types/annualFee';

/** Backend unavailable error — thrown when API is not yet implemented */
export class AnnualFeeBackendUnavailableError extends Error {
  constructor(message = 'Annual fee API is not yet available.') {
    super(message);
    this.name = 'AnnualFeeBackendUnavailableError';
  }
}

/**
 * Returns a rejected Promise with the standard "API not implemented"
 * error so async functions can `return` it and TypeScript recognizes
 * the call path as exhaustive (otherwise the async wrappers trip
 * `TS2355` because `never` does not satisfy the declared `Promise<T>`
 * return type under strict mode).
 */
const unavailable = (_method: string): Promise<never> =>
  Promise.reject(
    new AnnualFeeBackendUnavailableError(
      'Annual fee API is not yet implemented by the backend.',
    ),
  );

// ── Public fee plans (for subscription UI) ─────────────────────────────

/**
 * Fetch all active annual fee plans available for purchase.
 * Used by the subscription page to show available plans.
 */
export const listAnnualFeePlans = async (): Promise<AnnualFee[]> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.get<AnnualFee[]>(BASE_URL);
  // return response.data ?? [];
  return unavailable('listAnnualFeePlans');
};

/**
 * Fetch a single annual fee plan by ID.
 */
export const getAnnualFeePlan = async (_id: number): Promise<AnnualFee> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.get<AnnualFee>(`${BASE_URL}/${_id}`);
  // return response.data;
  return unavailable('getAnnualFeePlan');
};

// ── Admin fee plan management ────────────────────────────────────────

/**
 * Admin: Create a new annual fee plan.
 */
export const createAnnualFeePlan = async (
  _data: AnnualFeeUpsertRequest,
): Promise<AnnualFee> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.post<AnnualFee>(BASE_URL, _data);
  // return response.data;
  return unavailable('createAnnualFeePlan');
};

/**
 * Admin: Update an existing annual fee plan.
 */
export const updateAnnualFeePlan = async (
  _id: number,
  _data: AnnualFeeUpsertRequest,
): Promise<AnnualFee> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.put<AnnualFee>(`${BASE_URL}/${_id}`, _data);
  // return response.data;
  return unavailable('updateAnnualFeePlan');
};

/**
 * Admin: Delete an annual fee plan.
 */
export const deleteAnnualFeePlan = async (_id: number): Promise<void> => {
  // TODO: Replace with actual API call when BE implements
  // await api.delete(`${BASE_URL}/${_id}`);
  return unavailable('deleteAnnualFeePlan');
};

/**
 * Admin: Toggle whether a fee plan is active (accepting new purchases).
 */
export const toggleAnnualFeePlan = async (
  _id: number,
  _isActive: boolean,
): Promise<AnnualFee> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.patch<AnnualFee>(`${BASE_URL}/${_id}/toggle`, { isActive: _isActive });
  // return response.data;
  return unavailable('toggleAnnualFeePlan');
};

// ── User purchase flow ─────────────────────────────────────────────

/**
 * Initiate a purchase for an annual fee plan.
 * Returns a PayOS checkout URL to redirect the user.
 */
export const purchaseAnnualFee = async (
  _request: AnnualFeePurchaseRequest,
): Promise<AnnualFeePurchaseResponse> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.post<AnnualFeePurchaseResponse>(
  //   `${BASE_URL}/${_request.annualFeeId}/purchase`,
  //   _request,
  // );
  // return response.data;
  return unavailable('purchaseAnnualFee');
};

/**
 * Get the user's current active annual fee subscription.
 * Returns null if the user has no active subscription.
 */
export const getMyCurrentSubscription = async (): Promise<CurrentAnnualFeeSubscription | null> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.get<CurrentAnnualFeeSubscription | null>(`${BASE_URL}/my-current`);
  // return response.data ?? null;
  return unavailable('getMyCurrentSubscription');
};

/**
 * Get the user's annual fee purchase history.
 */
export const getMyPurchaseHistory = async (): Promise<AnnualFeePurchase[]> => {
  // TODO: Replace with actual API call when BE implements
  // const response = await api.get<AnnualFeePurchase[]>(`${BASE_URL}/my-purchases`);
  // return response.data ?? [];
  return unavailable('getMyPurchaseHistory');
};

// ── Service barrel export ────────────────────────────────────────────

export const annualFeeService = {
  listAnnualFeePlans,
  getAnnualFeePlan,
  createAnnualFeePlan,
  updateAnnualFeePlan,
  deleteAnnualFeePlan,
  toggleAnnualFeePlan,
  purchaseAnnualFee,
  getMyCurrentSubscription,
  getMyPurchaseHistory,
};

export default annualFeeService;
