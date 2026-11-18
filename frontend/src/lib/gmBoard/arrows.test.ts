import { describe, it, expect } from 'vitest';
import { makeCard } from '@/test-utils/factories';
import { arrowPath, causeLinks, isArrowMode, nearestPair, type Box } from './arrows';

const cards = [
  makeCard({ id: 'a', characterId: 1 }),
  makeCard({ id: 'b', characterId: 2, causedBy: ['a', 'scene-1'] }),
  makeCard({ id: 'c', characterId: 3, causedBy: ['b'] }),
  makeCard({ id: 'd', characterId: 1, branchOf: 'a' }),
];

describe('causeLinks', () => {
  it('draws nothing when off, or on hover with nothing hovered', () => {
    expect(causeLinks(cards, 'off', 'b')).toEqual([]);
    expect(causeLinks(cards, 'hover', null)).toEqual([]);
  });

  it('draws every cause and branch in All, hovered or not', () => {
    expect(causeLinks(cards, 'all', null)).toEqual([
      { from: 'a', to: 'b', kind: 'cause' },
      { from: 'scene-1', to: 'b', kind: 'cause' },
      { from: 'b', to: 'c', kind: 'cause' },
      { from: 'a', to: 'd', kind: 'branch' },
    ]);
  });

  it('on hover, draws only the hovered card’s causes and what it caused', () => {
    expect(causeLinks(cards, 'hover', 'b')).toEqual([
      { from: 'a', to: 'b', kind: 'cause' },
      { from: 'scene-1', to: 'b', kind: 'cause' },
      { from: 'b', to: 'c', kind: 'cause' },
    ]);
  });

  it('on hover over a scene, draws what the scene caused', () => {
    expect(causeLinks(cards, 'hover', 'scene-1')).toEqual([{ from: 'scene-1', to: 'b', kind: 'cause' }]);
  });

  it('skips a card that names itself', () => {
    expect(causeLinks([makeCard({ id: 'x', characterId: 1, causedBy: ['x'], branchOf: 'x' })], 'all', null)).toEqual([]);
  });
});

describe('isArrowMode', () => {
  it('accepts the three modes only', () => {
    expect(['hover', 'all', 'off'].every(isArrowMode)).toBe(true);
    expect(isArrowMode('always')).toBe(false);
    expect(isArrowMode(null)).toBe(false);
  });
});

const box = (left: number, top: number, w = 100, h = 40): Box => ({ left, top, right: left + w, bottom: top + h });

describe('arrowPath', () => {
  it('runs from the right edge to the left edge when the target is in a later column', () => {
    expect(arrowPath(box(0, 0), box(200, 100))).toBe('M100.0 20.0 Q132.0 88.0 200.0 120.0');
  });

  it('runs from the left edge when the target is in an earlier column', () => {
    expect(arrowPath(box(200, 0), box(0, 0))).toMatch(/^M200\.0 20\.0 Q.* 100\.0 20\.0$/);
  });

  it('runs bottom to top in one column, bending out', () => {
    expect(arrowPath(box(0, 0), box(0, 100))).toBe('M88.0 40.0 Q117.2 70.0 88.0 100.0');
  });

  it('runs top to bottom when the target is above', () => {
    expect(arrowPath(box(0, 100), box(0, 0))).toMatch(/^M88\.0 100\.0 Q.* 88\.0 40\.0$/);
  });
});

describe('nearestPair', () => {
  it('picks the copies closest to each other', () => {
    const near = box(0, 300);
    const target = box(200, 300);
    expect(nearestPair([box(0, 0), near], [target])).toEqual([near, target]);
  });

  it('is null when either end is missing', () => {
    expect(nearestPair([], [box(0, 0)])).toBeNull();
    expect(nearestPair([box(0, 0)], [])).toBeNull();
  });
});
