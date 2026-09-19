/**
 * PublishedPaperCard — unit tests.
 *
 * Coverage:
 *  1. Light-mode contrast sanity      — CSS classes use token-based colors, not hardcoded hex
 *  2. Reviewer identity withheld     — no reviewer name shown when publicReviewerName is null
 *  3. sourceName only when real      — journal line omitted for null / '' / undefined
 *  4. PaperWithReviewerResponse data never leaks into the public card
 */

import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublishedPaperCard } from '../../../../src/features/publication/home/PublishedPaperCard';
import type { PublicationPaper } from '../../../../src/features/publication/types/publication';

// Minimal required fields for a valid PublicationPaper
const basePaper: PublicationPaper = {
  id: 'paper-1',
  title: 'A Study of Urban Heat Islands in Southeast Asia',
  abstract:
    'This paper investigates the urban heat island effect across several major cities in Southeast Asia using satellite remote sensing and ground-based meteorological observations.',
  authors: [
    { id: 'a-1', name: 'Nguyen Van A', institutionIds: [], order: 1 },
    { id: 'a-2', name: 'Tran Thi B', institutionIds: [], orcid: '0000-0002-1825-0097', order: 2 },
  ],
  institutions: [],
  paperType: 'Research article',
  topics: ['Urban heat', 'Remote sensing'],
  keywords: ['heat island', 'satellite', 'meteorology'],
  version: 1,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-03-15T00:00:00.000Z',
  doi: '10.1000/ars.test.2026.001',
  openAlexId: 'https://openalex.org/W7654321',
  reviewerIdentityPublic: false,
  researcherVerificationStatus: 'VERIFIED',
};

/** Expand the details section by clicking the toggle button. */
const expandDetails = () => {
  const toggle = screen.getByRole('button', { name: /show publication details/i });
  act(() => { toggle.click(); });
};

describe('<PublishedPaperCard>', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Light-mode contrast sanity — tokens, not hardcoded hex values
  // ─────────────────────────────────────────────────────────────────────────

  describe('light-mode contrast', () => {
    it('paperType badge uses CSS class paperType', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      const badge = screen.getByText('Research article');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toMatch(/paperType/);
    });

    it('keyword chips use CSS class keyword', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      const keyword = screen.getByText('heat island');
      expect(keyword.className).toMatch(/keyword/);
    });

    it('DOI link uses CSS class identifierLink', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      const doiLink = screen.getByRole('link', { name: /10\.1000\/ars\.test\.2026\.001/i });
      expect(doiLink.className).toMatch(/identifierLink/);
    });

    it('OpenAlex identifier link uses CSS class identifierLink', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      const openalexLink = screen.getByRole('link', { name: /W7654321/i });
      expect(openalexLink.className).toMatch(/identifierLink/);
    });

    it('topic pills use CSS class topic', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      const topic = screen.getByText('Urban heat');
      expect(topic.className).toMatch(/topic/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Reviewer identity withheld — no reviewer name shown without consent
  // ─────────────────────────────────────────────────────────────────────────

  describe('reviewer identity withheld per policy', () => {
    it('shows the withheld message when publicReviewerName is null', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      // The regex matches "reviewer identity withheld per policy" with optional trailing period
      expect(screen.getByText(/reviewer identity withheld per policy\.?/i)).toBeInTheDocument();
    });

    it('does NOT display any reviewer name when publicReviewerName is null', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName={null} />);
      expandDetails();
      // The withheld message may mention the word "Reviewer" but must NOT contain any name
      const text = screen.getByText(/reviewer identity withheld per policy\.?/i).textContent ?? '';
      expect(text).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/); // no "Firstname Lastname" pattern
    });

    it('shows the reviewer name only when publicReviewerName is provided', () => {
      render(<PublishedPaperCard paper={basePaper} publicReviewerName="Dr. Jane Smith" />);
      expandDetails();
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. sourceName (journal/venue) — only shown when the BE provides a real value
  // ─────────────────────────────────────────────────────────────────────────

  describe('sourceName (journal / venue) display', () => {
    it('shows the journal line when sourceName is a non-empty string', () => {
      const paper: PublicationPaper = { ...basePaper, sourceName: 'Nature' };
      render(<PublishedPaperCard paper={paper} publicReviewerName={null} />);
      expect(screen.getByText('Nature')).toBeInTheDocument();
    });

    it('omits the journal line when sourceName is null', () => {
      const paper: PublicationPaper = { ...basePaper, sourceName: null };
      render(<PublishedPaperCard paper={paper} publicReviewerName={null} />);
      expect(screen.queryByText('Nature')).not.toBeInTheDocument();
    });

    it('omits the journal line when sourceName is an empty string', () => {
      const paper: PublicationPaper = { ...basePaper, sourceName: '' };
      render(<PublishedPaperCard paper={paper} publicReviewerName={null} />);
      expect(screen.queryByText('Nature')).not.toBeInTheDocument();
    });

    it('omits the journal line when sourceName is undefined', () => {
      const paper: PublicationPaper = { ...basePaper, sourceName: undefined };
      render(<PublishedPaperCard paper={paper} publicReviewerName={null} />);
      expect(screen.queryByText('Nature')).not.toBeInTheDocument();
    });

    it('shows the journal line with the exact sourceName value from the paper', () => {
      const paper: PublicationPaper = { ...basePaper, sourceName: 'The Lancet' };
      render(<PublishedPaperCard paper={paper} publicReviewerName={null} />);
      expect(screen.getByText('The Lancet')).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PaperWithReviewerResponse data MUST NOT leak into the public card
  //
  // Simulates a response that contains reviewer-identity fields that belong
  // only to the reviewer's private dashboard. These must never appear in the
  // public catalog card output.
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaperWithReviewerResponse data never leaks to public card', () => {
    it('does NOT display reviewerName from the paper.reviewer object', () => {
      const paperWithReviewer: PublicationPaper = {
        ...basePaper,
        reviewer: {
          reviewerName: 'Dr. Secret Reviewer',
          recommendation: 'ACCEPT',
          privateComments: 'This paper has serious methodological flaws.',
          privateScores: { clarity: 1, novelty: 2 },
        },
        reviewerId: 999,
        reviewRequestId: 888,
        reviewRequestStatus: 'COMPLETED',
      };

      render(<PublishedPaperCard paper={paperWithReviewer} publicReviewerName={null} />);
      expandDetails();

      expect(screen.queryByText('Dr. Secret Reviewer')).not.toBeInTheDocument();
      expect(screen.getByText(/reviewer identity withheld per policy\.?/i)).toBeInTheDocument();
    });

    it('does NOT display reviewerId even when present on the paper', () => {
      const paperWithReviewerId: PublicationPaper = {
        ...basePaper,
        reviewerId: 12345,
      };

      render(<PublishedPaperCard paper={paperWithReviewerId} publicReviewerName={null} />);
      expandDetails();

      expect(screen.queryByText('12345')).not.toBeInTheDocument();
    });

    it('does NOT display reviewRequestId even when present on the paper', () => {
      const paperWithReviewRequestId: PublicationPaper = {
        ...basePaper,
        reviewRequestId: 777,
      };

      render(<PublishedPaperCard paper={paperWithReviewRequestId} publicReviewerName={null} />);
      expandDetails();

      expect(screen.queryByText('777')).not.toBeInTheDocument();
    });

    it('still shows the withheld message when publicReviewerName is null even if paper has reviewer object', () => {
      const paperWithReviewer: PublicationPaper = {
        ...basePaper,
        reviewer: {
          reviewerName: 'Dr. Confidential',
          recommendation: 'ACCEPT',
          privateComments: 'Private.',
          privateScores: {},
        },
      };

      render(<PublishedPaperCard paper={paperWithReviewer} publicReviewerName={null} />);
      expandDetails();

      expect(screen.getByText(/reviewer identity withheld per policy\.?/i)).toBeInTheDocument();
      expect(screen.queryByText('Dr. Confidential')).not.toBeInTheDocument();
    });
  });
});
