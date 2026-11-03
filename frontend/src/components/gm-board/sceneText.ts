import type { MissReason } from '@/lib/gmBoard/moments';

/** Why a reader doesn't get a moment, as the Scenes step says it. */
export const MISS_TEXT: Record<MissReason, string> = {
  'no-text': 'Nothing written for them yet',
  note: 'GM note: nobody reads it',
  'not-ticked': 'Not ticked on this moment',
  'not-in-scene': 'Not in this scene',
};
