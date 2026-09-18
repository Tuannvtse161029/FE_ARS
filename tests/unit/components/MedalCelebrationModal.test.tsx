import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MedalCelebrationModal } from '../../../src/components/medals/MedalCelebrationModal';
import { signalrService } from '../../../src/services/signalr.service';
import { I18nProvider } from '../../../src/i18n/I18nContext';

const renderModal = (props = {}) => {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <MedalCelebrationModal {...props} />
      </MemoryRouter>
    </I18nProvider>
  );
};

describe('MedalCelebrationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render when no medal is provided and no SignalR event fired', () => {
    renderModal();
    expect(screen.queryByTestId('medal-celebration-modal')).not.toBeInTheDocument();
  });

  it('renders correctly when a controlled medal is passed', () => {
    const medal = {
      medalId: 101,
      medalName: 'Prolific Author',
      medalTier: 'Gold',
      description: 'Published 10 high-impact papers in leading journals.',
      iconUrl: 'lucide:BookOpen',
    };

    renderModal({ medal });

    expect(screen.getByTestId('medal-celebration-modal')).toBeInTheDocument();
    expect(screen.getByText('Prolific Author')).toBeInTheDocument();
    expect(screen.getByText(/Gold Tier|Hạng Vàng/i)).toBeInTheDocument();
    expect(screen.getByText('Published 10 high-impact papers in leading journals.')).toBeInTheDocument();
    expect(screen.getByTestId('medal-celebration-claim')).toBeInTheDocument();
    expect(screen.getByTestId('medal-celebration-profile')).toBeInTheDocument();
  });

  it('calls onClose when primary claim button is clicked', async () => {
    const onClose = vi.fn();
    const medal = {
      medalId: 102,
      medalName: 'Distinguished Reviewer',
      medalTier: 'Platinum',
    };

    renderModal({ medal, onClose });

    const claimButton = screen.getByTestId('medal-celebration-claim');
    fireEvent.click(claimButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close icon (X) button is clicked', async () => {
    const onClose = vi.fn();
    const medal = {
      medalName: 'Master Mentor',
      medalTier: 'Silver',
    };

    renderModal({ medal, onClose });

    const closeBtn = screen.getByTestId('medal-celebration-close');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const medal = {
      medalName: 'Keynote Speaker',
      medalTier: 'Bronze',
    };

    renderModal({ medal, onClose });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onViewProfile when profile button is clicked', () => {
    const onViewProfile = vi.fn();
    const onClose = vi.fn();
    const medal = {
      medalName: 'Seminar Pioneer',
    };

    renderModal({ medal, onClose, onViewProfile });

    const profileButton = screen.getByTestId('medal-celebration-profile');
    fireEvent.click(profileButton);

    expect(onViewProfile).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uncontrolled mode: pops up automatically upon receiving SignalR MedalAwarded event', async () => {
    renderModal();

    expect(screen.queryByTestId('medal-celebration-modal')).not.toBeInTheDocument();

    // Simulate incoming SignalR event
    await act(async () => {
      signalrService.emit('MedalAwarded', {
        medalId: 55,
        medalName: 'Community Anchor',
        medalTier: 'Gold',
        description: 'Awarded for active engagement in the scholarly forum.',
      });
    });

    expect(screen.getByTestId('medal-celebration-modal')).toBeInTheDocument();
    expect(screen.getByText('Community Anchor')).toBeInTheDocument();
    expect(screen.getByText('Awarded for active engagement in the scholarly forum.')).toBeInTheDocument();
  });
});
