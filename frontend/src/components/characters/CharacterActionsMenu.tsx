/**
 * Character Actions Menu Component
 *
 * Kebab-triggered menu for GM actions on a character. Currently one action:
 * hide/reveal an NPC.
 *
 * This exists to keep low-frequency GM controls out of the character sheet's
 * header. A hide/reveal toggle is touched perhaps once in an NPC's lifetime,
 * but a toggle rendered inline costs a band of prime real estate on every
 * sheet the GM opens -- above the tabs, which are what they actually came for.
 *
 * Modeled on ParticipantActionsMenu: same trigger, same outside-click close,
 * same absolutely-positioned role="menu" panel. Unlike that menu, nothing here
 * is confirmed -- hiding is freely reversible, and the menu item's label plus
 * the sheet's Hidden badge already report the current state.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import { useSetCharacterHidden } from '@/hooks/useCharacters';

interface CharacterActionsMenuProps {
  characterId: number;
  gameId?: number;
  /** Whether the character is currently hidden from players. */
  isHidden: boolean;
  /**
   * Whether the caller may hide/reveal this character. GM/co-GM and NPC-only,
   * decided by the sheet -- the backend rejects anything else with 403/400.
   */
  canToggleHidden: boolean;
}

export function CharacterActionsMenu({
  characterId,
  gameId,
  isHidden,
  canToggleHidden,
}: CharacterActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const setHiddenMutation = useSetCharacterHidden();

  // Close the menu when clicking outside it.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleHidden = useCallback(() => {
    setHiddenMutation.mutate({ characterId, isHidden: !isHidden, gameId });
    setIsOpen(false);
  }, [setHiddenMutation, characterId, isHidden, gameId]);

  // No actions available means no trigger at all, rather than a kebab that
  // opens an empty panel.
  if (!canToggleHidden) {
    return null;
  }

  return (
    <div className="relative flex-shrink-0" ref={menuRef} data-testid="character-actions-menu">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Character actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="text-content-tertiary hover:text-content-secondary h-auto p-2"
      >
        ⋮
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg border border-theme-default z-10 surface-raised">
          <div className="py-1" role="menu">
            <button
              onClick={handleToggleHidden}
              disabled={setHiddenMutation.isPending}
              className="block w-full text-left px-4 py-2 text-sm text-content-primary hover:surface-raised disabled:opacity-50"
              role="menuitem"
              data-testid="character-hidden-menu-item"
            >
              <div>{isHidden ? 'Reveal to players' : 'Hide from players'}</div>
              {/* The cost of hiding, kept here rather than on the sheet: it is
                  worth reading once, and nothing about it needs restating every
                  time the GM opens a character. */}
              {!isHidden && (
                <div className="text-xs text-content-tertiary">
                  Players will not see this NPC in the cast, its profile, @mentions or new
                  conversations. Anything it has already posted stays visible.
                </div>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
