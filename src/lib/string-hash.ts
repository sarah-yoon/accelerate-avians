/**
 * Tiny deterministic 32-bit string hash (FNV-1a). Used for deriving a
 * stable parallax-background seed from a passage id so the same race
 * always shows the same background, regardless of re-renders.
 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
