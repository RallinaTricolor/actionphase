import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, type ComboboxOption } from './Combobox';

const PLACES: ComboboxOption[] = [
  { value: 'mill', label: 'The Old Mill' },
  { value: 'dock', label: 'Dock', description: 'East side' },
  { value: 'hall', label: 'Great Hall' },
];

function Harness({ onCreate, initial = null }: { onCreate?: (text: string) => void; initial?: string | null }) {
  const [options, setOptions] = useState(PLACES);
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <Combobox
        label="Location"
        options={options}
        value={value}
        onChange={setValue}
        onCreate={
          onCreate &&
          ((text) => {
            onCreate(text);
            setOptions((o) => [...o, { value: 'new', label: text }]);
            setValue('new');
          })
        }
      />
      <output data-testid="value">{value ?? 'none'}</output>
    </>
  );
}

describe('Combobox', () => {
  it('shows the chosen option’s label, linked to its label', () => {
    render(<Harness initial="dock" />);
    expect(screen.getByLabelText('Location')).toHaveValue('Dock');
  });

  it('filters by what’s typed and picks with the keyboard', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Location');
    await userEvent.type(input, 'hal');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Great Hall']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('hall');
    expect(input).toHaveValue('Great Hall');
  });

  it('opens on focus with every option, descriptions included', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Location'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('East side')).toBeInTheDocument();
  });

  it('closes on Escape without changing the value', async () => {
    render(<Harness initial="mill" />);
    const input = screen.getByLabelText('Location');
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('mill');
  });

  it('offers to add a value that isn’t listed, only when allowed', async () => {
    const onCreate = vi.fn();
    const { unmount } = render(<Harness />);
    await userEvent.type(screen.getByLabelText('Location'), 'Lighthouse');
    expect(screen.queryByText('Add “Lighthouse”')).not.toBeInTheDocument();
    unmount();

    render(<Harness onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText('Location'), '  Lighthouse ');
    await userEvent.click(screen.getByRole('option', { name: 'Add “Lighthouse”' }));
    expect(onCreate).toHaveBeenCalledWith('Lighthouse');
    expect(screen.getByTestId('value')).toHaveTextContent('new');
    expect(screen.getByLabelText('Location')).toHaveValue('Lighthouse');
  });

  it('doesn’t offer to add a name that’s already listed, in any case', async () => {
    render(<Harness onCreate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Location'), 'dock');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['DockEast side']);
  });

  it('shows an error under the field', () => {
    render(<Combobox label="Location" options={PLACES} value={null} onChange={vi.fn()} error="Pick a location" />);
    expect(screen.getByText('Pick a location')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveAttribute('aria-invalid', 'true');
  });
});
