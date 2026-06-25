export function empresaUrl(company) {
  const slug = (company?.name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `https://mapasocietario.es/empresa/${slug}`;
}
