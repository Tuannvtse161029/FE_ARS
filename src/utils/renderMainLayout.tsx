/**
 * Test helper for `<MainLayout />` sidebar / header / wallet assertions.
 *
 * Provides a reusable mock surface and DOM-query helpers so the seven
 * MainLayout test files don't each duplicate the same vi.mock factories,
 * beforeEach cleanup, and sidebar query logic.
 *
 * Usage:
 *
 *   1. At the top of the test file, install the mocks with one call:
 *
 *        import './renderMainLayout.mockInstall';
 *        import {
 *          setMockAuth,
 *          renderMainLayout,
 *          findSidebarLinkByHref,
 *          findSidebarLinkByText,
 *        } from '../../../src/utils/renderMainLayout';
 *
 *      The side-effect import (a) calls vi.mock() at the top level and
 *      (b) registers a beforeEach() that clears auth + storage between
 *      tests.
 *
 *   2. Per test: set auth, render, assert.
 *
 *        setMockAuth({ role: 'Graduate Student', isActive: false });
 *        renderMainLayout('/forum');
 *        expect(findSidebarLinkByHref('/premium-packages')).toBeNull();
 *
 * Why this is split into a separate mock-install module: vitest requires
 * `vi.mock()` calls to live at the top level of the file that imports the
 * mocked module. Putting the calls inside an exported function would still
 * be hoisted, but vitest emits warnings and the install semantics are
 * subtle. The dedicated module is cleaner.
 */
import { vi, beforeEach } from 'vitest';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { buildMockAuth } from './mockAuth';
import type { MockUseAuthOptions } from './mockAuth';

export const useAuthMock = vi.fn();

/**
 * Drive the mocked useAuth() to return `buildMockAuth(opts)`.
 */
export const setMockAuth = (opts: MockUseAuthOptions = {}) => {
  useAuthMock.mockReturnValue(buildMockAuth(opts));
};

/**
 * Render MainLayout inside a MemoryRouter at `initialPath`.
 */
export const renderMainLayout = (initialPath: string): RenderResult =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainLayout />
    </MemoryRouter>,
  );

/**
 * Find the first anchor in the layout sidebar whose `href` exactly equals
 * `href`. Returns null if no match.
 */
export const findSidebarLinkByHref = (
  href: string,
): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    if (a.getAttribute('href') === href) {
      return a as HTMLAnchorElement;
    }
  }
  return null;
};

/**
 * Find the first anchor in the layout sidebar whose visible text matches
 * `text` (case-insensitive substring). Returns null if no match.
 */
export const findSidebarLinkByText = (
  text: string,
): HTMLAnchorElement | null => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const lower = text.toLowerCase();
  const anchors = aside.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    const t = (a.textContent ?? '').toLowerCase();
    if (t.includes(lower)) {
      return a as HTMLAnchorElement;
    }
  }
  return null;
};

/**
 * Install the standard MainLayout mock surface. Idempotent — safe to call
 * from any number of test files.
 */
export const setupMainLayoutMocks = () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
};
