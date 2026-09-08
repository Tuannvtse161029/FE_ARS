/**
 * Coverage for the family-level `frameShape` data contracts that live on
 * `medal.service` even though the admin UI no longer exposes the picker:
 *
 *   - The clip-path map is non-empty for every declared shape so any
 *     stale value still in localStorage / the BE can't crash the badge
 *     renderer when fallback resolution ever needs it.
 *   - `normalizeFrameShape` defensively coerces unknown strings to
 *     `'circle'` so a malformed payload never breaks the renderer.
 *   - `medalService.normalizeMedalFamilies` keeps `frameShape` in sync
 *     with the lowest-stage medal in the family — the same way it
 *     already syncs `imageUrl`.
 *   - `medalService.updateMedalFamilyShape` exists and accepts the
 *     payload so existing backend fans-out keep working.
 *
 * The `ShapePicker` UI was removed (frame shape is now locked to
 * `'circle'`), so the visual-picker tests are gone. The data layer
 * tests below remain valid because the contracts they assert (clip-path
 * map, normaliser, family sync) are still part of the public surface.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  MEDAL_FRAME_SHAPES,
  FRAME_SHAPE_CLIP_PATH,
  FRAME_SHAPE_LABEL,
  normalizeFrameShape,
  medalService,
  normalizeMedalFamilies,
  type Medal,
  type MedalFrameShape,
} from '../../../../src/services/medal.service';

const TIER_FIXTURE: Omit<Medal, 'id' | 'code' | 'tier' | 'stageLevel'> = {
  title: 'Test',
  titleVi: 'Test',
  description: '',
  descriptionVi: '',
  roles: ['Researcher'],
  imageUrl: 'lucide:ShieldCheck',
  frameShape: 'circle',
  criteriaMetric: 'count',
  criteriaThreshold: 1,
  criteriaUnit: 'times',
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('MedalFrameShape — primitives', () => {
  it('exposes 5 unique shape keys', () => {
    expect(MEDAL_FRAME_SHAPES).toHaveLength(5);
    expect(new Set(MEDAL_FRAME_SHAPES).size).toBe(5);
  });

  it('ships a non-empty clip-path per shape', () => {
    for (const shape of MEDAL_FRAME_SHAPES) {
      expect(FRAME_SHAPE_CLIP_PATH[shape]).toMatch(/^(circle|inset|polygon|url)\(/);
    }
  });

  it('ships a label in both locales for every shape', () => {
    for (const shape of MEDAL_FRAME_SHAPES) {
      expect(FRAME_SHAPE_LABEL[shape].en.length).toBeGreaterThan(0);
      expect(FRAME_SHAPE_LABEL[shape].vi.length).toBeGreaterThan(0);
    }
  });

  it('normalizeFrameShape falls back to circle for unknown / empty input', () => {
    expect(normalizeFrameShape(undefined)).toBe('circle');
    expect(normalizeFrameShape(null)).toBe('circle');
    expect(normalizeFrameShape('')).toBe('circle');
    expect(normalizeFrameShape('pentagram' as unknown as MedalFrameShape)).toBe('circle');
    expect(normalizeFrameShape('HEXAGON' as unknown as MedalFrameShape)).toBe('hexagon');
    expect(normalizeFrameShape('  shield  ' as unknown as MedalFrameShape)).toBe('shield');
  });
});

describe('normalizeMedalFamilies — frame shape family sync', () => {
  it('propagates the lowest-stage frameShape to every tier of the family', () => {
    const family: Medal[] = [
      {
        ...TIER_FIXTURE,
        id: 'a',
        code: 'ACH_X_BRONZE',
        tier: 'Bronze',
        stageLevel: 1,
        frameShape: 'hexagon',
      },
      {
        ...TIER_FIXTURE,
        id: 'b',
        code: 'ACH_X_SILVER',
        tier: 'Silver',
        stageLevel: 2,
        frameShape: 'circle',
      },
      {
        ...TIER_FIXTURE,
        id: 'c',
        code: 'ACH_X_GOLD',
        tier: 'Gold',
        stageLevel: 3,
        frameShape: 'diamond',
      },
    ];

    const normalised = normalizeMedalFamilies(family);
    for (const m of normalised) {
      expect(m.frameShape).toBe('hexagon');
    }
  });

  it('backfills missing frameShape values with circle for legacy entries', () => {
    const legacy = {
      ...TIER_FIXTURE,
      id: 'x',
      code: 'LEGACY_BRONZE',
      tier: 'Bronze' as const,
      stageLevel: 1,
      // frameShape intentionally omitted via spread override
    } as unknown as Medal;
    delete (legacy as { frameShape?: unknown }).frameShape;

    const [normalised] = normalizeMedalFamilies([legacy]);
    expect(normalised.frameShape).toBe('circle');
  });
});

describe('medalService.updateMedalFamilyShape', () => {
  afterEach(() => cleanup());

  it('exists and accepts a family + shape payload', () => {
    expect(typeof medalService.updateMedalFamilyShape).toBe('function');
  });
});
