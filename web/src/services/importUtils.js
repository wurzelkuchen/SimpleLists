/**
 * Utility functions for parsing and cleaning imported list items.
 */

/**
 * Cleans a single line from an imported text list:
 * - Trims leading and trailing whitespace
 * - Strips common markdown checkboxes like [ ], [x], [X], [✓]
 * - Strips list bullet points like -, *, +, •, ◦, ▪, ▫, ⁃, –, —, ✓, ✔, ➜, ➤
 * - Strips numbered list markers like "1.", "1)", "(1)", "1 -"
 * - Preserves negative numbers (e.g. "-10 degrees") and hyphenated words (e.g. "T-shirt")
 * - Iteratively strips if multiple markers are combined (e.g. "- [ ] item" or "* 1. item")
 * 
 * @param {string} rawLine
 * @returns {string} cleaned line
 */
export function cleanImportLine(rawLine) {
  if (!rawLine) return '';
  let line = rawLine.trim();
  if (!line) return '';

  let prev = '';
  // Repeat while changes occur (handles chained markers like "- [ ] task" or "* 1. item")
  while (line !== prev) {
    prev = line;

    // 1. Remove markdown checkbox patterns: [ ], [x], [X], [v], [V], [✓], [✔]
    line = line.replace(/^\[[ xX\u2713\u2714]?\]\s*/, '');

    // 2. Remove common bullet characters at the start.
    // For '-' we require either whitespace or a non-digit character to preserve negative numbers (e.g. "-5")
    line = line.replace(/^([*+•◦▪▫‣⁃–—✓✔➜➤]|-(?!\d))\s*/, '');

    // 3. Remove numbered list prefixes: e.g. "1.", "1)", "(1)", "1 -", "1 –"
    line = line.replace(/^(\(?\d+[\.\)]|\d+\s*[-–—])\s*/, '');

    line = line.trim();
  }

  return line;
}

/**
 * Splits a raw multiline text blob, cleans each line, and filters out empty lines.
 * 
 * @param {string} textBlob
 * @returns {string[]} array of cleaned item strings
 */
export function parseImportLines(textBlob) {
  if (!textBlob || typeof textBlob !== 'string') return [];
  return textBlob
    .split(/\r?\n/)
    .map(line => cleanImportLine(line))
    .filter(line => line.length > 0);
}
