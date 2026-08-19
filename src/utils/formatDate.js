/**
 * Locale-aware short date formatter (dd/mm/yyyy) shared by the network graph
 * and its company inspector panel.
 *
 * Returns '-' for anything missing or unparseable so callers can render the
 * result straight into a table cell without null-guarding every call site.
 */
export const formatDate = (dateStr, language = 'es') => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(language === 'en' ? 'en-GB' : 'es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

export default formatDate;
