import { describe, it, expect } from 'vitest';
import { makeBoard, makeMoment, makeScene } from '@/test-utils/factories';
import { coverageFor, isCovered, setCovered } from './coverage';

const reader = { names: ['Harrison'], secondPerson: true };
const door = makeMoment({ id: 'door', text: 'Harrison opens the door.', readers: [1] });

describe('isCovered', () => {
  it('matches the reader’s text in any part of any result, ignoring case', () => {
    expect(isCovered(door, 1, ['Part one.', 'Then YOU OPEN THE DOOR. And more.'], undefined, reader)).toBe(true);
    expect(isCovered(door, 1, ['Harrison opens the door.'], undefined, reader)).toBe(false);
    expect(isCovered(door, 1, ['Harrison opens the door.'], undefined, { ...reader, secondPerson: false })).toBe(true);
  });

  it('lets an explicit tick win both ways', () => {
    expect(isCovered(door, 1, [], { door: true }, reader)).toBe(true);
    expect(isCovered(door, 1, ['You open the door.'], { door: false }, reader)).toBe(false);
  });

  it('never covers a moment with no text', () => {
    expect(isCovered({ ...door, text: '' }, 1, ['anything'], undefined, reader)).toBe(false);
  });

  it('ticks a moment when the GM inserts it, keeping other ticks', () => {
    expect(setCovered({ ready: true, covered: { other: false } }, 'door', true)).toEqual({
      ready: true,
      covered: { other: false, door: true },
    });
    expect(setCovered(undefined, 'door', true)).toEqual({ covered: { door: true } });
  });
});

describe('coverageFor', () => {
  it('counts the moments the character reads and lists the missing ones', () => {
    const board = makeBoard({
      scenes: [
        makeScene({
          id: 's',
          moments: [
            door,
            makeMoment({ id: 'alarm', text: 'An alarm rings.', readers: [1] }),
            makeMoment({ id: 'ticked', text: 'Smoke rises.', readers: [1] }),
            makeMoment({ id: 'other', text: 'Not for Harrison.', readers: [2] }),
          ],
        }),
      ],
      covered: { 1: { ticked: true } },
    });
    const c = coverageFor(board, 1, ['You open the door.'], reader);
    expect(c.total).toBe(3);
    expect(c.done).toBe(2);
    expect(c.missing.map((m) => m.id)).toEqual(['alarm']);
  });
});
