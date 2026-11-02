import { describe, it, expect } from 'vitest';
import { verbFor, youify } from './youify';

const names = ['Harrison Vale', 'Harrison'];
const text = (t: string, n = names) => youify(t, n).text;

describe('youify', () => {
  it('swaps a subject name and fixes its verb', () => {
    const r = youify('Harrison enters the room.', names);
    expect(r.text).toBe('You enter the room.');
    expect(r.marks).toEqual([
      { start: 0, end: 3, kind: 'you' },
      { start: 4, end: 9, kind: 'verb' },
    ]);
    expect(r.swapped).toBe(1);
  });

  it('turns is/has/does into are/have/do, including contractions', () => {
    expect(text('Harrison is tired. Harrison has a key, and Harrison does nothing.')).toBe(
      'You are tired. You have a key, and you do nothing.',
    );
    expect(text('Harrison isn’t ready. Harrison doesn\'t care.')).toBe('You aren’t ready. You don\'t care.');
  });

  it('turns the possessive into "your"', () => {
    expect(text('Harrison’s sword breaks.')).toBe('Your sword breaks.');
    expect(text('The guard takes Harrison\'s sword.')).toBe('The guard takes your sword.');
  });

  it('leaves the verb alone when the name isn’t the subject', () => {
    expect(text('The guard hits Harrison hard.')).toBe('The guard hits you hard.');
  });

  it('finds the subject after a conjunction, a comma, or an adverb', () => {
    expect(text('Mara waits, then Harrison opens the door.')).toBe('Mara waits, then you open the door.');
    expect(text('Harrison quickly runs.')).toBe('You quickly run.');
    expect(text('In the dark, Harrison carries the lamp.')).toBe('In the dark, you carry the lamp.');
  });

  it('matches the longest name first and only whole names', () => {
    expect(text('Harrison Vale watches.', ['Harrison', 'Harrison Vale'])).toBe('You watch.');
    expect(text('The Harrisons arrive.')).toBe('The Harrisons arrive.');
  });

  it('marks he/she words for checking once a name was swapped', () => {
    const r = youify('Harrison waves. She nods at him.', names);
    expect(r.text).toBe('You wave. She nods at him.');
    const checks = r.marks.filter((m) => m.kind === 'check').map((m) => r.text.slice(m.start, m.end));
    expect(checks).toEqual(['She', 'him']);
  });

  it('changes nothing when the reader has no names, or none appear', () => {
    expect(youify('Harrison enters.', [])).toEqual({ text: 'Harrison enters.', marks: [], swapped: 0 });
    expect(youify('She enters.', names)).toEqual({ text: 'She enters.', marks: [], swapped: 0 });
    expect(youify('Harrison enters.', ['H'])).toEqual({ text: 'Harrison enters.', marks: [], swapped: 0 });
  });

  it('starts a sentence after a line break or a quote mark', () => {
    expect(text('First.\nHarrison runs.')).toBe('First.\nYou run.');
    expect(text('“Harrison goes.”')).toBe('“You go.”');
  });
});

describe('verbFor', () => {
  it('drops the third-person ending', () => {
    expect(verbFor('enters')).toBe('enter');
    expect(verbFor('carries')).toBe('carry');
    expect(verbFor('watches')).toBe('watch');
    expect(verbFor('goes')).toBe('go');
  });

  it('refuses words that aren’t third-person verbs', () => {
    expect(verbFor('pass')).toBeNull();
    expect(verbFor('always')).toBeNull();
    expect(verbFor('the')).toBeNull();
    expect(verbFor('Paris')).toBeNull();
  });
});
