import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubscriptionBadge } from '../../../../src/components/subscription/SubscriptionBadge';
import { useSubscription } from '../../../../src/hooks/useSubscription';

// Mock useSubscription so we can control isApplicable / current state.
vi.mock('../../../../src/hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}));

const mockUseSubscription = vi.mocked(useSubscription);

const renderBadge = () =>
  render(
    <MemoryRouter>
      <SubscriptionBadge />
    </MemoryRouter>,
  );

describe('SubscriptionBadge', () => {
  beforeEach(() => {
    mockUseSubscription.mockReset();
  });

  it('renders as a clickable button when the role requires a subscription', () => {
    mockUseSubscription.mockReturnValue({
      current: {
        daysRemaining: 30,
        isExpired: false,
        isApplicable: true,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        annualFee: { name: 'Researcher Yearly' },
      },
      isApplicable: true,
      isLoading: false,
      refetch: vi.fn(),
      error: null,
    } as never);

    renderBadge();
    const button = screen.getByTestId('subscription-badge-active');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('aria-label');
  });

  it('renders as a plain div when subscription is not applicable to the role', () => {
    mockUseSubscription.mockReturnValue({
      current: null,
      isApplicable: false,
      isLoading: false,
      refetch: vi.fn(),
      error: null,
    } as never);

    renderBadge();
    const node = screen.getByTestId('subscription-badge-na');
    expect(node.tagName).toBe('DIV');
    expect(node).not.toHaveAttribute('aria-label');
  });

  it('renders the loading state as a clickable button', () => {
    mockUseSubscription.mockReturnValue({
      current: null,
      isApplicable: true,
      isLoading: true,
      refetch: vi.fn(),
      error: null,
    } as never);

    renderBadge();
    const button = screen.getByTestId('subscription-badge-loading');
    expect(button.tagName).toBe('BUTTON');
  });
});
