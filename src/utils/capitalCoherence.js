/**
 * Is a BORME capital figure contradicted by the filing that set it?
 *
 * A "Reducción/Ampliación de capital" entry states both halves in one sentence
 * — the amount moved and the capital left standing — so the gazette's own
 * arithmetic can check the figure before we publish it.
 *
 * MAIER NAVARRA SL was gazetted as reducing capital by EUR 700.872,80 and being
 * left with EUR 6.231.559.999,99: a reduction of 0.011% of the result, which no
 * company files. The parser was faithful — BORME published that string — but it
 * reached the page, the graph and the DD report as fact. Informa puts the real
 * figure at EUR 3.000-60.000 and Iberinform/eInforma above EUR 1.000.000: three
 * providers across three orders of magnitude. Nothing here reconstructs the
 * truth; it only marks the figure as one we cannot stand behind.
 *
 * The test is deliberately narrow. A SMALL amount against a large capital is a
 * real and common filing — a nominal-value redenomination so the share nominal
 * divides cleanly (TESTA RESIDENCIAL SOCIMI SA moved EUR 0,57 against EUR 132m;
 * HOTELES MARINA D'OR SL, EUR 3,00 against EUR 114m). Magnitude alone would
 * delete good data. Only a SUBSTANTIAL amount that shifts a negligible share of
 * the stated result is incoherent: across 150 sampled companies and 75
 * checkable entries this fires on MAIER and nothing else.
 *
 * Shared by the /empresa Pages Function, the graph's company preview and any
 * other surface that publishes the number, so one rule governs all of them.
 */

const AMOUNT_FLOOR = 10000;
const INCOHERENT_RATIO = 0.001;
// Spanish grouping: dots separate thousands, the comma is the decimal point.
const ES_AMOUNT = String.raw`(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+)`;
const IMPORTE = new RegExp(`Importe[^:]{0,40}:\\s*${ES_AMOUNT}`, 'i');
const RESULTANTE = new RegExp(`Resultante[^:]{0,40}:\\s*${ES_AMOUNT}`, 'i');
// Cents of drift between the gazette string and the aggregated figure.
const MATCH_TOLERANCE = 1;

/** "6.231.559.999,99" -> 6231559999.99 */
function parseEsAmount(text) {
  const value = Number(String(text).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {number|string|null} capital the figure about to be published
 * @param {Array<{full_entry?: string, has_capital_change?: boolean}>} events
 * @returns {boolean} true when the filing that set this figure contradicts it
 */
export function hasIncoherentCapital(capital, events) {
  const current = toNumber(capital);
  if (current === null || !(current > 0)) return false;

  for (const event of events || []) {
    const entry = (event && event.full_entry) || '';
    if (!entry) continue;
    const importe = IMPORTE.exec(entry);
    const resultante = RESULTANTE.exec(entry);
    if (!importe || !resultante) continue;

    const amount = parseEsAmount(importe[1]);
    const result = parseEsAmount(resultante[1]);
    if (!amount || !result || result <= 0) continue;

    // Only the filing whose stated result IS this figure can condemn it; an
    // older incoherent entry says nothing about a capital later replaced.
    if (Math.abs(result - current) > MATCH_TOLERANCE) continue;
    if (amount >= AMOUNT_FLOOR && amount / result < INCOHERENT_RATIO) return true;
  }
  return false;
}
