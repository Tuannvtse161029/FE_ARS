import type { AnnualFeeDto } from '../types/annualFee';

export class AnnualFeeBackendUnavailableError extends Error {
  constructor() {
    super(
      'Annual Fees are unavailable because the backend has not published an AnnualFee API. See tickets/backend/BE_ANNUAL_FEE_API_TICKET.md.',
    );
    this.name = 'AnnualFeeBackendUnavailableError';
  }
}

const unavailable = async (): Promise<never> => {
  throw new AnnualFeeBackendUnavailableError();
};

export const annualFeeService = {
  listAnnualFees: unavailable as () => Promise<AnnualFeeDto[]>,
  getAnnualFee: async (_id: number): Promise<AnnualFeeDto | null> => unavailable(),
};

export default annualFeeService;
