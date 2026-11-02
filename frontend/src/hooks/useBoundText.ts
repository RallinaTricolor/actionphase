import { useEffect, useState } from 'react';

/**
 * Local state for a text box bound to a saved value that can change under it
 * (another GM's edit arriving by polling). The box keeps its own text: the
 * board's cache tells its readers about a change a tick later, too late for a
 * controlled box, so typing would lose characters and move the cursor. The
 * saved value replaces the text only while the box isn't focused.
 *
 * Spread `bind` onto the box; call `setText` from its onChange.
 */
export function useBoundText(saved: string) {
  const [text, setText] = useState(saved);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(saved);
  }, [saved, focused]);

  return {
    text,
    setText,
    bind: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}
