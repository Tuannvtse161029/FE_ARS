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
  it('introduces ARS and links visitors to login', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /research moves further when knowledge moves together/i,
      }),
    ).toBeInTheDocument();

    const loginLinks = screen.getAllByRole('link', { name: /log in/i });
    expect(loginLinks.some((link) => link.getAttribute('href') === '/login')).toBe(true);
  });

  it('labels the fictional testimonials as illustrative', () => {
    renderLanding();

    expect(
      screen.getByText(/they are examples, not verified customer reviews/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Illustrative researcher review')).toBeInTheDocument();
  });
});
