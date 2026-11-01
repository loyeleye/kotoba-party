// The shape of the frame test lines in this folder (tests/frames.test.ts reads them).

/** A line as the game stores it: kana only, or written text with its kana reading. */
export type CaseLine = string | { text: string; kana: string };

export type FrameCases = Record<string, { pos: CaseLine[]; neg: [CaseLine, string][] }>;
