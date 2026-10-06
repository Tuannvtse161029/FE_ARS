/**
 * Unit tests for the ResearcherResponsibilityModal — scrollable content
 * area (Oct 2026 fix).
 *
 * Bug fix (Oct 2026): users reported they could not scroll the
 * Researcher Responsibility policy inside the modal. The root cause
 * was a missing `min-height: 0` on the flex item that owns the
 * scroll container — without it, the default `min-height: auto`
 * makes the flex item as tall as its content, so the modal grew
 * past `max-height: 88vh` and got clipped by the parent's
 * `overflow: hidden` instead of scrolling.
 *
 * jsdom does not load external CSS modules, so we cannot use
 * `getComputedStyle` to verify the computed `overflow-y` or
 * `min-height`. Instead, these tests pin the CSS module's source
 * text — the actual declaration that fixes the bug — so a future
 * refactor that drops `min-height: 0` (or removes `overflow-y: auto`)
 * trips the test. Combined with the class-name assertion, this
 * gives us a contract for the rendered DOM AND the styles that
 * apply to it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSS_PATH = join(
  __dirname,
  '../../../../src/components/policy/ResearcherResponsibilityModal.module.css',
);

// Stable dictionary stub — we only need a couple of keys for this test.
const translate = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    fallback ?? key,
  );

vi.mock('../../../../src/i18n/I18nContext', () => ({
  useT: () => translate,
  useLocale: () => 'en',
}));

const { mockPolicyService } = vi.hoisted(() => ({
  mockPolicyService: {
    getOne: vi.fn(),
    listAll: vi.fn(),
    save: vi.fn(),
    subscribe: vi.fn(),
    invalidate: vi.fn(),
  },
}));

vi.mock('../../../../src/services/policy.service', () => ({
  policyService: mockPolicyService,
}));

import { ResearcherResponsibilityModal } from '../../../../src/components/policy/ResearcherResponsibilityModal';

const LONG_POLICY_TEXT = Array.from({ length: 80 }, (_, i) => {
  const n = i + 1;
  return `${n}. Section ${n}\n\nThis is the body of section ${n}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;
}).join('\n\n');

const renderModal = () =>
  render(
    <ResearcherResponsibilityModal
      isOpen={true}
      onAgree={vi.fn()}
      onClose={vi.fn()}
    />,
  );

describe('ResearcherResponsibilityModal — scrollable content (Oct 2026 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPolicyService.getOne.mockResolvedValue({
      slug: 'researcher_responsibility',
      title: 'Researcher Responsibility',
      content: LONG_POLICY_TEXT,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
      fromFirestore: true,
    });
  });

  it('declares `overflow-y: auto` on the content area so the user can scroll', () => {
    // The bug was that the policy body was clipped by the parent's
    // `overflow: hidden` because the flex item had no min-height
    // constraint. The fix needs two things working together:
    //   • `overflow-y: auto` on the content (so a scrollbar appears)
    //   • `min-height: 0` on the content (so the flex item can
    //     actually shrink and engage the scroll)
    // We pin BOTH declarations in the CSS source so a future
    // refactor cannot drop either one without breaking this test.
    const css = readFileSync(CSS_PATH, 'utf-8');
    const contentBlock = css.match(/\.content\s*\{([\s\S]*?)\}/);
    expect(contentBlock, '`.content { … }` block must exist in the CSS').not.toBeNull();
    const contentBody = contentBlock![1]!;
    expect(contentBody).toMatch(/overflow-y:\s*auto/);
  });

  it('declares `min-height: 0` on the content area (the actual fix)', () => {
    // This is the property that was missing. Without it, the default
    // `min-height: auto` makes the flex item as tall as its content,
    // so the modal grew past `max-height: 88vh` and got clipped by
    // the parent's `overflow: hidden` instead of scrolling. The
    // fix pins `min-height: 0` so the flex item can shrink to the
    // available space and the `overflow-y: auto` finally engages.
    const css = readFileSync(CSS_PATH, 'utf-8');
    const contentBlock = css.match(/\.content\s*\{([\s\S]*?)\}/);
    expect(contentBlock).not.toBeNull();
    const contentBody = contentBlock![1]!;
    expect(
      contentBody,
      '`.content` must declare `min-height: 0` so the flex item can shrink and engage scroll. ' +
        'Without it, the default `min-height: auto` makes the item as tall as its content, ' +
        'and the modal gets clipped instead of scrolling.',
    ).toMatch(/min-height:\s*0/);
  });

  it('keeps the modal surface clipped (`overflow: hidden`) so the rounded corners stay anchored', () => {
    // The modal surface is the clipping container. The scroll
    // container is the inner `.content` div. If both had visible
    // overflow, the rounded corners would leak and the user could
    // double-scroll. We pin the two together so a refactor doesn't
    // accidentally break the layout shape.
    const css = readFileSync(CSS_PATH, 'utf-8');
    const modalBlock = css.match(/\.modal\s*\{([\s\S]*?)\}/);
    expect(modalBlock).not.toBeNull();
    expect(modalBlock![1]!).toMatch(/overflow:\s*hidden/);
  });

  it('constrains the modal surface to viewport height with `max-height: 88vh`', () => {
    // The modal must never grow past the viewport. Without a
    // viewport-relative cap, a long policy would push the modal
    // off-screen on small displays. 88vh is the existing contract.
    const css = readFileSync(CSS_PATH, 'utf-8');
    const modalBlock = css.match(/\.modal\s*\{([\s\S]*?)\}/);
    expect(modalBlock).not.toBeNull();
    expect(modalBlock![1]!).toMatch(/max-height:\s*88vh/);
  });

  it('still renders the modal, content, and agree CTA after a long policy load', async () => {
    // End-to-end smoke test — confirms the modal structure survives
    // a 80-section policy. The user's report was that they could
    // not scroll; this test asserts the rest of the modal still
    // works (header, agree checkbox, footer) which is the contract
    // the fix must NOT break.
    renderModal();
    const modal = await screen.findByTestId('researcher-responsibility-modal');
    expect(modal).toBeInTheDocument();
    const content = await screen.findByTestId('researcher-responsibility-content');
    await waitFor(() => {
      expect(content.textContent).toContain('Section 1');
    });
    // The agree CTA and checkbox are still mounted.
    const checkbox = screen.getByTestId('researcher-responsibility-checkbox');
    const agreeCta = screen.getByTestId('researcher-responsibility-agree');
    expect(checkbox).toBeInTheDocument();
    expect(agreeCta).toBeInTheDocument();
    expect(agreeCta).toBeDisabled();
    // Ticking the checkbox still enables the CTA — behaviour is
    // unchanged by the CSS fix.
    fireEvent.click(checkbox);
    expect(agreeCta).not.toBeDisabled();
  });
});
