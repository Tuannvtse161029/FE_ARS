import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Landing } from '../../../src/pages/Landing';

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );

describe('Landing', () => {
  it('introduces the accountable editorial workflow and links visitors to login', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /a responsible path for research to be read, reviewed, and shared/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /five stages/i })).toBeInTheDocument();

    const loginLinks = screen.getAllByRole('link', { name: /log in/i });
    expect(loginLinks.some((link) => link.getAttribute('href') === '/login')).toBe(true);
  });

  it('states that public discovery excludes private editorial material', () => {
    renderLanding();

    expect(
      screen.getByText(/only approved public research is discoverable in the catalog/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/private review comments, scores, and administrative notes remain/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/illustrative researcher review/i)).not.toBeInTheDocument();
  });
});
