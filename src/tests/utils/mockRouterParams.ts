/**
 * Test utilities for react-router-dom route-param hooks.
 *
 * Lets a test seed `useParams` and `useNavigate` returns without
 * rebuilding a MemoryRouter for every test that needs a single id.
 */
import { vi } from 'vitest';

export const mockParams = (params: Record<string, string | undefined>) => {
  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
    return {
      ...actual,
      useParams: () => params,
      useNavigate: () => vi.fn(),
      useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    };
  });
};