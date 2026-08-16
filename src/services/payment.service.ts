import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { PaymentCreateRequest, PaymentLink } from '../types/domain';

export const paymentService = {
  createLink: async (req: PaymentCreateRequest): Promise<PaymentLink> => {
    const response = await api.post<PaymentLink>(API_ENDPOINTS.PAYMENT.CREATE_LINK, req);
    return response.data;
  },

  getSuccess: async (orderCode: string | number): Promise<unknown> => {
    const response = await api.get(API_ENDPOINTS.PAYMENT.SUCCESS, { params: { orderCode } });
    return response.data;
  },

  getCancel: async (orderCode: string | number): Promise<unknown> => {
    const response = await api.get(API_ENDPOINTS.PAYMENT.CANCEL, { params: { orderCode } });
    return response.data;
  },

  cancelOrder: async (orderCode: string | number): Promise<unknown> => {
    const response = await api.post(API_ENDPOINTS.PAYMENT.CANCEL_ORDER(orderCode));
    return response.data;
  },
};
