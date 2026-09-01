import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrcidIdentityMarker } from '../../../src/components/identity/OrcidIdentityMarker';

describe('OrcidIdentityMarker', () => {
  it('renders a safe accessible external link for a confirmed valid linkage', () => {
    render(
      <OrcidIdentityMarker
        orcidId="0000-0002-1825-0097"
        isOrcidVerified={true}
      />,
    );

    const marker = screen.getByRole('link', { name: 'ORCID iD connected' });
    expect(marker).toHaveAttribute('href', 'https://orcid.org/0000-0002-1825-0097');
    expect(marker).toHaveAttribute('target', '_blank');
    expect(marker).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([
    { orcidId: '0000-0002-1825-0097', isOrcidVerified: false },
    { orcidId: 'not-an-orcid', isOrcidVerified: true },
    { orcidId: undefined, isOrcidVerified: true },
  ])('does not render for an unconfirmed or invalid record', (props) => {
    render(<OrcidIdentityMarker {...props} />);
    expect(screen.queryByTestId('orcid-identity-marker')).toBeNull();
  });
});
