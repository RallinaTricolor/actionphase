import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeCard, makeScene } from '@/test-utils/factories';
import type { ArrowMode } from '@/lib/gmBoard/arrows';
import { MapByCharacter } from './MapByCharacter';
import { MapByLocation } from './MapByLocation';
import { noDrag, testActions, testModel } from './mapTestModel';

// jsdom has no layout, so every box is 0×0; these tests check which arrows
// are drawn, not where.
const board = {
  cards: [
    makeCard({ id: 'a', characterId: 1, locationId: 'mill', chunkId: 'k1', summary: 'Rings the bell' }),
    makeCard({ id: 'b', characterId: 2, locationId: 'mill', chunkId: 'k2', summary: 'Runs off', causedBy: ['a'] }),
    makeCard({ id: 'c', characterId: 3, locationId: 'dock', chunkId: 'k2', summary: 'Hides', causedBy: ['scene-1'] }),
    makeCard({ id: 'd', characterId: 3, locationId: 'dock', chunkId: 'k3', summary: 'Waits' }),
  ],
  scenes: [makeScene({ id: 'scene-1', title: 'The bell', locationId: 'mill', chunkId: 'k1', participants: [1, 3] })],
};

function renderLocation(mode: ArrowMode, openId: string | null = null) {
  return render(<MapByLocation model={testModel(board)} actions={testActions()} drag={noDrag()} arrows={{ mode, openId }} />);
}

const arrows = () => screen.queryAllByTestId('map-arrow-cause');
const card = (name: RegExp) => screen.getByRole('button', { name });

describe('MapArrowLayer', () => {
  it('draws nothing on hover until a card is hovered, then only that card’s causes', () => {
    renderLocation('hover');
    expect(screen.queryByTestId('map-arrows')).not.toBeInTheDocument();

    fireEvent.mouseOver(card(/Runs off/));
    expect(arrows()).toHaveLength(1);

    fireEvent.mouseOver(card(/Waits/));
    expect(arrows()).toHaveLength(0);

    fireEvent.mouseOver(card(/Hides/));
    expect(arrows()).toHaveLength(1);
  });

  it('draws a scene’s arrows when its name in a cell is hovered', () => {
    renderLocation('hover');
    fireEvent.mouseOver(screen.getByRole('button', { name: /The bell/ }));
    expect(arrows()).toHaveLength(1);
  });

  it('shows the open card’s causes on hover, and the hovered card wins while hovered', () => {
    renderLocation('hover', 'b');
    expect(arrows()).toHaveLength(1);
    fireEvent.mouseOver(card(/Waits/));
    expect(arrows()).toHaveLength(0);
    fireEvent.mouseLeave(screen.getByRole('region', { name: 'Locations by time slot' }).firstElementChild!);
    expect(arrows()).toHaveLength(1);
  });

  it('follows keyboard focus, as hover does', () => {
    renderLocation('hover');
    fireEvent.focus(card(/Hides/));
    expect(arrows()).toHaveLength(1);
  });

  it('keeps a focused card’s arrows while the pointer rests on a cell', () => {
    renderLocation('hover');
    fireEvent.focus(card(/Hides/));
    fireEvent.mouseOver(screen.getByTestId('cell-mill-k2'));
    expect(arrows()).toHaveLength(1);
    fireEvent.mouseOver(card(/Waits/));
    expect(arrows()).toHaveLength(0);
  });

  it('draws every arrow in All, fading the others while one card is hovered', () => {
    renderLocation('all');
    expect(arrows()).toHaveLength(2);
    expect(arrows().some((p) => p.getAttribute('class')?.includes('gm-arrow-faint'))).toBe(false);
    fireEvent.mouseOver(card(/Runs off/));
    expect(arrows().filter((p) => p.getAttribute('class')?.includes('gm-arrow-faint'))).toHaveLength(1);
  });

  it('draws nothing when off', () => {
    renderLocation('off', 'b');
    fireEvent.mouseOver(card(/Runs off/));
    expect(screen.queryByTestId('map-arrows')).not.toBeInTheDocument();
  });

  it('skips a cause that isn’t on screen (a folded moot card)', () => {
    const moot = { ...board, cards: [makeCard({ id: 'm', characterId: 1, locationId: 'mill', chunkId: 'k1', outcome: 'moot' }), makeCard({ id: 'n', characterId: 2, locationId: 'mill', chunkId: 'k2', summary: 'Shrugs', causedBy: ['m'] })] };
    render(<MapByLocation model={testModel(moot)} actions={testActions()} drag={noDrag()} arrows={{ mode: 'all', openId: null }} />);
    expect(arrows()).toHaveLength(0);
  });

  it('draws By character too, from a scene shown in several rows', () => {
    render(<MapByCharacter model={testModel(board)} actions={testActions()} drag={noDrag()} arrows={{ mode: 'all', openId: null }} />);
    expect(screen.getAllByRole('button', { name: /The bell/ })).toHaveLength(2);
    expect(arrows()).toHaveLength(2);
  });
});
