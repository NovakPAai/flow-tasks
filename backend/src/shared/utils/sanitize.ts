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
