// Subscription service — Researcher / Lecturer paid access via PayOS.
//
// This service is the FE's only entry point for talking to the
// backend subscription API. It is intentionally thin: it owns
// request shapes, never calculates prices, and never signs PayOS
// requests.
//
// Until the BE publishes the documented subscription endpoints, the
// service throws `SubscriptionBackendUnavailableError` from every
// method. Pages that subscribe to this service render the visible
// "awaiting backend API" banner instead of pretending the integration
// works.
//
// When the BE ships the endpoints, drop the unavailable stubs and let
// each method call `api.get(...)` / `api.post(...)` against the
// documented paths.

import type {
  SubscriptionOrderRequest,
  SubscriptionOrderResponse,
  SubscriptionPaymentStatusResponse,
  SubscriptionPlan,
  UserSubscription,
} from '../types/subscription';
import { SubscriptionBackendUnavailableError } from '../types/subscription';

const unavailable = (method: string): never => {
  throw new SubscriptionBackendUnavailableError(
    `Subscription.${method} is awaiting backend API and VND pricing configuration.`,
  );
};

export const subscriptionService = {
  /**
   * Fetch the BE's list of available subscription plans (duration, price,
   * currency). The FE renders the price from this response verbatim — it
   * never fabricates VND amounts.
   */
  listPlans: async (): Promise<SubscriptionPlan[]> => unavailable('listPlans'),

  /**
   * Fetch the current authenticated user's subscription snapshot. The FE
   * uses the returned `status` + `expiresAt` to decide whether the user
   * still has paid access.
   */
  getCurrentSubscription: async (): Promise<UserSubscription | null> =>
    unavailable('getCurrentSubscription'),

  /**
   * Create a PayOS-backed subscription order. The BE determines the VND
   * amount and returns an authorized PayOS `checkoutUrl` for the FE to
   * redirect the browser to. The FE never signs PayOS requests itself.
   */
  createOrder: async (
    _request: SubscriptionOrderRequest,
  ): Promise<SubscriptionOrderResponse> => unavailable('createOrder'),

  /**
   * Look up the authoritative payment/order status for a given order
   * code. The FE calls this after PayOS redirects back to ARS so it can
   * tell the user "we are verifying your subscription" without claiming
   * success until the BE returns a paid status.
   */
  getPaymentStatus: async (
    _orderCode: string,
  ): Promise<SubscriptionPaymentStatusResponse> =>
    unavailable('getPaymentStatus'),
};

export default subscriptionService;
