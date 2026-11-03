import { describe, it, expect } from 'vitest';
import { characterNames, defaultNames, escapeRegExp, plainText, shortName, splitList, termIn, truncate } from './text';

describe('termIn', () => {
  it('matches a single word case-sensitively and only as a whole word', () => {
    expect(termIn('Rose opens the vault.', 'Rose')).toBe(true);
    expect(termIn('a rose by the door', 'Rose')).toBe(false);
    expect(termIn('Roseanne waves', 'Rose')).toBe(false);
  });

  it('matches a phrase in any case', () => {
    expect(termIn('They find the iron key under the mat.', 'Iron Key')).toBe(true);
  });

  it('treats regex characters in the term literally', () => {
    expect(termIn('Code (A+) is live', '(A+)')).toBe(true);
    expect(termIn('Code AA is live', 'A+')).toBe(false);
  });

  it('never matches an empty term', () => {
    expect(termIn('anything', '  ')).toBe(false);
  });
});

describe('plainText and truncate', () => {
  it('keeps link and mention text and drops emphasis', () => {
    expect(plainText('**Bold** [[Mara|@Mara]] and [docs](https://example.test/x)')).toBe('Bold Mara and docs');
  });

  it('cuts long text to one line with an ellipsis', () => {
    expect(truncate('one\n two   three', 9)).toBe('one two …');
    expect(truncate('short', 10)).toBe('short');
  });
});

describe('names', () => {
  it('defaults to the full name plus a first word of 3+ letters', () => {
    expect(defaultNames('Mara Quill')).toEqual(['Mara Quill', 'Mara']);
    expect(defaultNames('Jo Quill')).toEqual(['Jo Quill']);
    expect(defaultNames('Mara')).toEqual(['Mara']);
  });

  it('skips a title, and gives no short name after an article', () => {
    expect(defaultNames('Sir Aldric')).toEqual(['Sir Aldric', 'Aldric']);
    expect(defaultNames('Dr. Vance Holt')).toEqual(['Dr. Vance Holt', 'Vance']);
    expect(defaultNames('The Dark Lord')).toEqual(['The Dark Lord']);
    expect(defaultNames('Zara the Mystic')).toEqual(['Zara the Mystic', 'Zara']);
  });

  it('uses the GM’s list when there is one, even an empty one', () => {
    expect(characterNames({ 3: ['Quill', 'the courier'] }, 3, 'Mara Quill')).toEqual(['Quill', 'the courier']);
    expect(characterNames({ 3: [] }, 3, 'Mara Quill')).toEqual([]);
    expect(characterNames({}, 3, 'Mara Quill')).toEqual(['Mara Quill', 'Mara']);
  });

  it('escapes every regex metacharacter', () => {
    expect(new RegExp(escapeRegExp('a.b*c?')).test('a.b*c?')).toBe(true);
  });
});

describe('splitList', () => {
  it('splits a typed list on commas, dropping blanks', () => {
    expect(splitList(' mill,  the stalls ,, ')).toEqual(['mill', 'the stalls']);
    expect(splitList('')).toEqual([]);
  });
});

describe('shortName', () => {
  it('keeps the first word', () => {
    expect(shortName('Shade (Whisper)')).toBe('Shade');
    expect(shortName('  Mara ')).toBe('Mara');
  });

  it('keeps a stand-in name whole', () => {
    expect(shortName('Character 12')).toBe('Character 12');
    expect(shortName('Character Actor')).toBe('Character');
  });

  it('skips a title, and keeps a name that starts with an article whole', () => {
    expect(shortName('Sir Aldric')).toBe('Aldric');
    expect(shortName('The Dark Lord')).toBe('The Dark Lord');
  });
});
