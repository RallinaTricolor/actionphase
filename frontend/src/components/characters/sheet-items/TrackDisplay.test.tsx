import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackDisplay } from './TrackDisplay';
import type { TrackValue } from '@/lib/sheetEntries';

const renderTrack = (track: TrackValue, entryName = 'Stress') =>
  render(<TrackDisplay label="Amount" entryName={entryName} track={track} />);

describe('TrackDisplay', () => {
  it('shows the label and value', () => {
    renderTrack({ value: 1200 });
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText((1200).toLocaleString())).toBeInTheDocument();
  });

  it('shows the maximum alongside the value', () => {
    renderTrack({ value: 4, max: 9 });
    expect(screen.getByText('/ 9')).toBeInTheDocument();
  });

  it('draws boxes for a boxes track', () => {
    renderTrack({ value: 4, max: 9, display: 'boxes' });
    const track = screen.getByRole('img', { name: 'Stress, Amount: 4 of 9' });
    expect(track.querySelectorAll('span')).toHaveLength(9);
  });

  it('draws a bar for a bar track', () => {
    renderTrack({ value: 3, max: 6, display: 'track' });
    const track = screen.getByRole('img', { name: 'Stress, Amount: 3 of 6' });
    // The bar is a single element; the box track renders one span per box.
    expect(track.querySelectorAll('span')).toHaveLength(0);
  });

  it('names the drawn track by its label alone when the entry has no name', () => {
    renderTrack({ value: 3, max: 6, display: 'track' }, '');
    expect(screen.getByRole('img', { name: 'Amount: 3 of 6' })).toBeInTheDocument();
  });

  // A bare quantity has nothing to draw a bar or boxes against.
  it('draws nothing for an unbounded track', () => {
    renderTrack({ value: 500, display: 'boxes' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // Absent display is what a saved "Number" track with a maximum looks like:
  // the write path never stores the literal 'number'.
  it('draws nothing for a bounded track with no display', () => {
    renderTrack({ value: 8, max: 10 });
    expect(screen.getByText('/ 10')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('draws nothing for a non-positive maximum', () => {
    renderTrack({ value: 0, max: 0, display: 'boxes' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // Twenty boxes is already a wide row on a phone; past that the bar carries
  // the same information legibly.
  it('falls back to a bar past the box limit', () => {
    renderTrack({ value: 30, max: 100, display: 'boxes' });
    const track = screen.getByRole('img', { name: 'Stress, Amount: 30 of 100' });
    expect(track.querySelectorAll('span')).toHaveLength(0);
  });

  it('falls back to a bar for a fractional maximum', () => {
    renderTrack({ value: 2, max: 4.5, display: 'boxes' });
    const track = screen.getByRole('img', { name: 'Stress, Amount: 2 of 4.5' });
    expect(track.querySelectorAll('span')).toHaveLength(0);
  });

  // Overfilled stress is a real state in several systems.
  it('clamps an overfilled bar to full width', () => {
    renderTrack({ value: 14, max: 10, display: 'track' });
    const fill = screen.getByRole('img').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});
