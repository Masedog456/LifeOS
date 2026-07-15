/**
 * Small deterministic string hash (LIFEOS-015). Used for embedding content
 * hashes and freshness fingerprints — NOT for security. FNV-1a, hex output.
 */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Fold to an unsigned 32-bit hex string.
  return (h >>> 0).toString(16).padStart(8, "0");
}
