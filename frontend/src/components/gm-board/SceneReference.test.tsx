import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCodexEntry, makeMoment } from '@/test-utils/factories';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import { SceneReference } from './SceneReference';
import { sceneModel } from './sceneTestModel';

const sheet = (id: string, name: string, description = ''): SheetItem => ({ id, name, refKind: 'item', tabKey: 'inventory', tabLabel: 'Inventory', description });

function setup() {
  const model = sceneModel({ participants: [1, 2], moments: [makeMoment({ id: 'm', text: 'Harrison lights the Lantern.', readers: [1, 2] })] });
  const props = { onInsert: vi.fn(), onMomentFromPassage: vi.fn() };
  render(
    <SceneReference
      model={model}
      plans={{ location: undefined, placeName: () => 'the Old Mill', slotName: () => 'Slot 1', onSetOutcome: vi.fn(), onTrigger: vi.fn(), onMomentFromCard: vi.fn(), onJoin: vi.fn(), onOpenCard: vi.fn() }}
      submissions={new Map([[2, 'I hide behind the wheel.']])}
      sheetItems={new Map([[1, [sheet('a', 'Lantern', 'A brass lantern.'), sheet('b', 'Rope'), sheet('c', 'Pistol')]]])}
      codex={[makeCodexEntry({ id: 'ledger', name: 'the ledger', type: 'Item', notes: 'Proof of the debt.' }), makeCodexEntry({ id: 'mill', name: 'the Old Mill', type: 'Location' })]}
      characters={[{ id: 1, names: ['Harrison'] }, { id: 2, names: ['Mara'] }]}
      {...props}
    />,
  );
  return props;
}

describe('SceneReference', () => {
  it('starts on Plans', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Plans' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('scene-plans')).toBeInTheDocument();
  });

  it('shows the submission of someone in the scene, with → Moment', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Submission' }));
    expect(screen.getByText('I hide behind the wheel.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '→ Moment from paragraph' }));
    expect(h.onMomentFromPassage).toHaveBeenCalledWith(2, 'I hide behind the wheel.');
  });

  it('lists a sheet with what the scene already uses, searches it, and inserts a name in bold', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Sheet' }));
    expect(screen.getByTestId('sheet-item-a')).toHaveTextContent('used');
    await userEvent.type(screen.getByLabelText('Search the sheet'), 'pis');
    expect(screen.queryByTestId('sheet-item-a')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Insert Pistol' }));
    expect(h.onInsert).toHaveBeenCalledWith('**Pistol**');
  });

  it('searches the codex by name or notes and inserts a name', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Codex' }));
    await userEvent.type(screen.getByLabelText('Search the codex'), 'debt');
    expect(screen.queryByText('the Old Mill')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Insert the ledger' }));
    expect(h.onInsert).toHaveBeenCalledWith('the ledger');
  });
});
