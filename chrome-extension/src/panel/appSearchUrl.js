export function appSearchUrl(company) {
  return `https://mapasocietario.es/app?search=${encodeURIComponent(company?.name || '')}`;
}
