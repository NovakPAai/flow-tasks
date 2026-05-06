import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Apply schema validators (min/max/refine) AFTER stripping HTML,
// so constraints are checked against the clean value, not raw input.
export const stripHtml = (schema: z.ZodString) =>
  z.string()
    .transform(val => sanitizeHtml(val, PLAIN_TEXT_OPTIONS).trim())
    .pipe(schema);

// Escape special HTML characters for safe interpolation into HTML strings.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip newlines from strings that flow into email headers to prevent header injection.
export function sanitizeEmailHeader(s: string): string {
  return s.replace(/[\r\n]/g, ' ').trim();
}
