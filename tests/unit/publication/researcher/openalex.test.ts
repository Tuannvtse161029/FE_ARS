import { describe, expect, it, vi } from 'vitest';
import {
  normalizeOpenAlexId,
  isValidOpenAlexId,
  classifyOpenAlexCandidate,
  buildOpenAlexScanPreview,
  rejectInvalidOpenAlexId,
  OpenAlexInvalidFormatError,
  OpenAlexUnsupportedVariantError,
} from '../../../../src/features/publication/researcher/openalex';

describe('researcher/openalex — normalization', () => {
  it('accepts a canonical short form', () => {
    expect(normalizeOpenAlexId('W2741809807')).toBe('W2741809807');
  });

  it('uppercases a lowercase short form', () => {
    expect(normalizeOpenAlexId('w2741809807')).toBe('W2741809807');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeOpenAlexId('   W2741809807  ')).toBe('W2741809807');
  });

  it('extracts the ID from an api.openalex.org URL', () => {
    expect(normalizeOpenAlexId('https://api.openalex.org/works/W2741809807')).toBe('W2741809807');
    expect(normalizeOpenAlexId('http://openalex.org/works/W123')).toBe('W123');
  });

  it('rejects DOIs and other unsupported variants by returning empty string', () => {
    expect(normalizeOpenAlexId('doi:10.5555/ars.demo.2026.001')).toBe('');
    expect(normalizeOpenAlexId('10.5555/ars.demo.2026.001')).toBe('');
  });

  it('rejects IDs that contain non-digits', () => {
    expect(normalizeOpenAlexId('W2741809807ABCD')).toBe('');
    expect(normalizeOpenAlexId('W')).toBe('');
    expect(normalizeOpenAlexId('W-2741809807')).toBe('');
  });

  it('rejects empty input', () => {
    expect(normalizeOpenAlexId('')).toBe('');
    expect(normalizeOpenAlexId('   ')).toBe('');
  });
});

describe('researcher/openalex — isValidOpenAlexId', () => {
  it('returns true for valid forms', () => {
    expect(isValidOpenAlexId('W2741809807')).toBe(true);
    expect(isValidOpenAlexId('https://api.openalex.org/works/W2741809807')).toBe(true);
  });

  it('returns false for invalid forms', () => {
    expect(isValidOpenAlexId('doi:10.5555/foo')).toBe(false);
    expect(isValidOpenAlexId('garbage')).toBe(false);
    expect(isValidOpenAlexId('')).toBe(false);
  });
});

describe('researcher/openalex — classifyOpenAlexCandidate', () => {
  it('classifies canonical short form', () => {
    expect(classifyOpenAlexCandidate('W2741809807')).toEqual({ mode: 'short', payload: 'W2741809807' });
  });

  it('classifies URL form', () => {
    expect(classifyOpenAlexCandidate('https://api.openalex.org/works/W2741809807')).toEqual({
      mode: 'url',
      payload: 'W2741809807',
    });
  });

  it('classifies DOI form', () => {
    expect(classifyOpenAlexCandidate('doi:10.5555/ars.demo.2026.001')).toEqual({
      mode: 'doi',
      payload: 'doi:10.5555/ars.demo.2026.001',
    });
  });

  it('classifies unknown', () => {
    expect(classifyOpenAlexCandidate('').mode).toBe('unknown');
    expect(classifyOpenAlexCandidate('garbage').mode).toBe('unknown');
  });
});

describe('researcher/openalex — buildOpenAlexScanPreview', () => {
  it('returns a deterministic, ID-derived preview without network calls', () => {
    const preview = buildOpenAlexScanPreview('W2741809807');
    expect(preview.id).toBe('W2741809807');
    expect(preview.display.title).toContain('W2741809807');
    expect(preview.display.source).toBe('demo');
    expect(preview.display.sourceLabel).toMatch(/no live OpenAlex/i);
  });

  it('throws OpenAlexInvalidFormatError for invalid identifiers', () => {
    expect(() => buildOpenAlexScanPreview('garbage')).toThrow(OpenAlexInvalidFormatError);
  });
});

describe('researcher/openalex — rejectInvalidOpenAlexId', () => {
  it('returns the canonical ID for valid input', () => {
    expect(rejectInvalidOpenAlexId('w2741809807')).toBe('W2741809807');
  });

  it('throws OpenAlexUnsupportedVariantError for DOIs', () => {
    expect(() => rejectInvalidOpenAlexId('doi:10.5555/foo')).toThrow(OpenAlexUnsupportedVariantError);
  });

  it('throws OpenAlexInvalidFormatError for garbage', () => {
    expect(() => rejectInvalidOpenAlexId('not-an-openalex-id')).toThrow(OpenAlexInvalidFormatError);
    expect(() => rejectInvalidOpenAlexId('W')).toThrow(OpenAlexInvalidFormatError);
  });
});
