import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  PaymentCreateRequest,
  PaymentLink,
  PaymentStatusResult,
} from '../types/domain';

// Provider-neutral payment service backed by the PayOS integration in the
// deployed Swagger (https://arsplatform.onrender.com/swagger/index.html).
// Endpoints match the OpenAPI document verbatim:
//
//   POST  /api/Payment/create-link        — PayOS checkout-link creation
//   GET   /api/Payment/success?…          — PayOS "Paid" confirmation
//   GET   /api/Payment/cancel?…           — PayOS "Cancelled" reconciliation
//   POST  /api/Payment/cancel/{orderCode} — Force-cancel an open PayOS order
//   POST  /api/Payment/webhook            — PayOS webhook (backend-only)
//
// `createLink` only returns a usable PaymentLink if the BE echoes the
// PayOS `checkoutUrl`. The FE never assumes the link is present.
export const paymentService = {
  createLink: async (req: PaymentCreateRequest): Promise<PaymentLink> => {
    const response = await api.post<PaymentLink>(
      API_ENDPOINTS.PAYMENT.CREATE_LINK,
      req,
    );
    return response.data;
  },

  // PayOS redirects the browser to `returnUrl` with ?orderCode=&status=&code=
  // appended. We confirm with the BE using the same query params (the BE
  // resolves them to a wallet top-up). Returned shape is intentionally loose
  // — the Swagger spec marks the response as `200 OK` with no schema.
  getSuccess: async (
    orderCode: string | number,
    status?: string,
    code?: string,
  ): Promise<PaymentStatusResult> => {
    const response = await api.get<PaymentStatusResult>(
      API_ENDPOINTS.PAYMENT.SUCCESS,
      { params: { orderCode, status, code } },
    );
    return response.data;
  },

  // Same endpoint family for the cancellation path. PayOS may also redirect
  // with `?status=CANCELLED` — the BE will normalise that to a "cancelled"
  // response.
  getCancel: async (
    orderCode: string | number,
  ): Promise<PaymentStatusResult> => {
    const response = await api.get<PaymentStatusResult>(
      API_ENDPOINTS.PAYMENT.CANCEL,
      { params: { orderCode } },
    );
    return response.data;
  },

  // Best-effort cancellation triggered from the FE when the user backs out
  // before the PayOS redirect lands. The BE is the source of truth for the
  // resulting wallet state — the FE re-fetches the wallet afterwards.
  cancelOrder: async (
    orderCode: string | number,
  ): Promise<PaymentStatusResult> => {
    const response = await api.post<PaymentStatusResult>(
      API_ENDPOINTS.PAYMENT.CANCEL_ORDER(orderCode),
    );
    return response.data;
  },
};