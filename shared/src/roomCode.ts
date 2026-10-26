// Consonants only: no vowels means no accidental words, and no I/O/U/Y avoids 1/0/V confusion.
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;

export function randomRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips spaces so "bcdf " and "BCDF" find the same room. */
export function normalizeRoomCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function isRoomCode(input: string): boolean {
  if (input.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of input) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}
