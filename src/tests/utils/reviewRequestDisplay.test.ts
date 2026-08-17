import { describe, expect, it } from 'vitest';
import {
  resolvePaperTitle,
  samePaperId,
} from '../../utils/reviewRequestDisplay';
import type { Paper } from '../../services/paper.service';
import type { ReviewRequest } from '../../services/reviewRequest.service';

const makePaper = (id: string, title: string): Paper => ({
  id,
  title,
  status: '',
});

const makeReq = (paperId: number | null, paperTitle?: string): Pick<ReviewRequest, 'paperId' | 'paperTitle'> => ({
  paperId,
  paperTitle,
});

describe('samePaperId (defect 1B)', () => {
  it('treats numeric and string ids of the same value as equal', () => {
    expect(samePaperId(123, '123')).toBe(true);
    expect(samePaperId('123', 123)).toBe(true);
  });

  it('returns false for different ids', () => {
    expect(samePaperId(123, 124)).toBe(false);
    expect(samePaperId('123', '124')).toBe(false);
  });

  it('returns false when either side is null/undefined', () => {
    expect(samePaperId(null, '1')).toBe(false);
    expect(samePaperId(undefined, '1')).toBe(false);
    expect(samePaperId('1', null)).toBe(false);
  });
});

describe('resolvePaperTitle (defect 1B — progressive hydration)', () => {
  it('returns title immediately when req.paperTitle is set', () => {
    const result = resolvePaperTitle({
      req: makeReq(42, 'My Paper'),
      papersById: new Map(),
    });
    expect(result.kind).toBe('title');
    if (result.kind === 'title') {
      expect(result.title).toBe('My Paper');
      expect(result.paperId).toBe('42');
    }
  });

  it('returns id-only resolution when paper is missing from page list', () => {
    const result = resolvePaperTitle({
      req: makeReq(42),
      papersById: new Map<string, Paper>(),
      extraPapersById: new Map<string, Paper>(),
    });
    expect(result.kind).toBe('id');
    if (result.kind === 'id') {
      expect(result.paperId).toBe('42');
    }
  });

  it('finds a paper when its id is in papersById (string id)', () => {
    const papersById = new Map<string, Paper>([['42', makePaper('42', 'Hello')]]);
    const result = resolvePaperTitle({
      req: makeReq(42),
      papersById,
    });
    expect(result.kind).toBe('title');
    if (result.kind === 'title') {
      expect(result.title).toBe('Hello');
    }
  });

  it('finds a paper via out-of-band extraPapersById cache', () => {
    const extra = new Map<string, Paper>([['42', makePaper('42', 'Out-of-band')]]);
    const result = resolvePaperTitle({
      req: makeReq(42),
      papersById: new Map(),
      extraPapersById: extra,
    });
    expect(result.kind).toBe('title');
    if (result.kind === 'title') {
      expect(result.title).toBe('Out-of-band');
    }
  });

  it('returns unknown when paperId is null and no joined title', () => {
    const result = resolvePaperTitle({
      req: makeReq(null),
      papersById: new Map(),
    });
    expect(result.kind).toBe('unknown');
  });

  it('does NOT fabricate a title when paperId is unknown — caller decides "Paper #id" or escalation', () => {
    const result = resolvePaperTitle({
      req: makeReq(999),
      papersById: new Map(),
      extraPapersById: new Map(),
    });
    expect(result.kind).toBe('id');
    if (result.kind === 'id') {
      // The helper hands back the id; the UI displays `Paper #${paperId}`.
      expect(result.paperId).toBe('999');
    }
  });
});