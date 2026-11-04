const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Allows only http(s), mailto, and in-page/relative links. Blocks javascript:, data:, vbscript:, etc. */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  // Strip whitespace and control characters that browsers ignore when parsing schemes.
  // eslint-disable-next-line no-control-regex
  const trimmed = url.replace(/[\u0000- \u007f-\u009f]/g, '');
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) return !trimmed.startsWith('//');
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (!schemeMatch) return true; // relative path without a scheme
  return SAFE_PROTOCOLS.has(schemeMatch[1].toLowerCase() + ':');
}

export function sanitizeUrl(url: string): string {
  return isSafeUrl(url) ? url : '';
}

/** Creates a conversation title from the first user prompt. */
export function titleFromPrompt(prompt: string, maxLength = 60): string {
  const firstLine = prompt.trim().split(/\r?\n/).find((l) => l.trim()) ?? '';
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'New chat';
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1).trimEnd()}…` : collapsed;
}

/** Splits text into streamable chunks of N words, preserving all whitespace exactly. */
export function chunkText(text: string, wordsPerChunk: number): string[] {
  const size = Math.max(1, Math.floor(wordsPerChunk));
  const parts = text.match(/\s*\S+/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += size) chunks.push(parts.slice(i, i + size).join(''));
  const trailing = text.match(/\s+$/);
  if (trailing) {
    if (chunks.length) chunks[chunks.length - 1] += trailing[0];
    else chunks.push(trailing[0]);
  }
  return chunks;
}
