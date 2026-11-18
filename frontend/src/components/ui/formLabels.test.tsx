import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, DateTimeInput, Input, Radio, Select, Textarea } from '@/components/ui';

// A label must reach its field even when the caller passes neither id nor name.
describe('form field labels without an id or name', () => {
  it('links each field to its label', () => {
    render(
      <>
        <Input label="Title" />
        <Textarea label="Notes" />
        <Select label="Phase">
          <option>One</option>
        </Select>
        <Checkbox label="Player chooses" />
        <DateTimeInput label="Deadline" />
      </>
    );
    expect(screen.getByLabelText('Title').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Phase').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Player chooses')).toHaveAttribute('type', 'checkbox');
    expect(screen.getByLabelText('Deadline').tagName).toBe('INPUT');
  });

  it('gives two fields with the same label different ids', () => {
    render(
      <>
        <Input label="Name" />
        <Input label="Name" />
      </>
    );
    const [a, b] = screen.getAllByLabelText('Name');
    expect(a.id).not.toBe(b.id);
  });

  it('keeps an id or name the caller gave', () => {
    render(
      <>
        <Input label="By id" id="given-id" />
        <Input label="By name" name="given-name" />
        <Radio label="Plan A" name="plan" value="a" />
      </>
    );
    expect(screen.getByLabelText('By id').id).toBe('given-id');
    expect(screen.getByLabelText('By name').id).toBe('given-name');
    expect(screen.getByLabelText('Plan A').id).toBe('plan-a');
  });

  it('selects the radio whose label was clicked when radios have no value', async () => {
    render(
      <>
        <Radio label="Every phase" name="scope" />
        <Radio label="This phase" name="scope" />
      </>
    );
    await userEvent.click(screen.getByText('This phase'));
    expect(screen.getByLabelText('This phase')).toBeChecked();
    expect(screen.getByLabelText('Every phase')).not.toBeChecked();
  });
});
