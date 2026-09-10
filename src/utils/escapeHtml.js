// The single HTML-escape helper for every string this app interpolates into
// markup it generates (the situation report, its exported file, copy-for-Word).
// Node notes are user input, so this is the XSS boundary of that whole path.
// The ampersand MUST be replaced first, or the entities written by the later
// replacements get their own ampersands escaped a second time.

export const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
