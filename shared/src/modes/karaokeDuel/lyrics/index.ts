// Every song's lyric sets by audience (kids, family, cheeky), one file per song, keyed by version id.
// The room's Audience setting picks which sets a game sings: see karaokeDuel.ts (pickLyrics).

import type { LyricSet } from '../songs.js';
import { LYRICS as ameNoMinato } from './ame-no-minato.js';
import { LYRICS as dokoItteta } from './doko-itteta.js';
import { LYRICS as getsuyoubi } from './getsuyoubi.js';
import { LYRICS as hashire } from './hashire.js';
import { LYRICS as jikoshoukaiRap } from './jikoshoukai-rap.js';
import { LYRICS as kanpai } from './kanpai.js';
import { LYRICS as kirakiraIdol } from './kirakira-idol.js';
import { LYRICS as nemurenaiYoru } from './nemurenai-yoru.js';
import { LYRICS as saveShite } from './save-shite.js';
import { LYRICS as yoruNoDrive } from './yoru-no-drive.js';

export const LYRIC_SETS: Readonly<Record<string, readonly LyricSet[]>> = {
  ...ameNoMinato,
  ...dokoItteta,
  ...getsuyoubi,
  ...hashire,
  ...jikoshoukaiRap,
  ...kanpai,
  ...kirakiraIdol,
  ...nemurenaiYoru,
  ...saveShite,
  ...yoruNoDrive,
};

/** A version's lyric sets (none for the children's sing-alongs). */
export const lyricSetsOf = (songId: string): readonly LyricSet[] => LYRIC_SETS[songId] ?? [];
