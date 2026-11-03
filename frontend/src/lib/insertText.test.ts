import { describe, it, expect } from 'vitest';
import { insertAt } from './insertText';

describe('insertAt', () => {
  it('puts spaces around an insert only where it would run into a word', () => {
    expect(insertAt('Mara lifts the', 14, 14, '**Lantern**')).toEqual({ value: 'Mara lifts the **Lantern**', cursor: 26 });
    expect(insertAt('lifts.', 0, 0, 'Mara')).toEqual({ value: 'Mara lifts.', cursor: 4 });
    expect(insertAt('the x.', 4, 5, 'mill')).toEqual({ value: 'the mill.', cursor: 8 });
    expect(insertAt('', 3, 3, 'Ilse')).toEqual({ value: 'Ilse', cursor: 4 });
  });
});
