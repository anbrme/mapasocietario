/**
 * Automated traffic that executes JavaScript, and therefore lands in GA4.
 *
 * GA4's own bot filtering only removes agents that identify themselves. The
 * traffic this module excludes does not: on 30 Aug 2026 it contributed 71 of
 * the property's 122 "users" — 40 reporting Chrome 131.0.0.0 and 31 reporting
 * Chrome 119.0.0.0 at an 800x600 viewport, every one of them from the US, one
 * session, one page view, and ZERO engaged sessions between them. The email
 * led with 122 users on a day that had roughly 25 real ones.
 *
 * THE SIGNATURE. Chrome sends its full build number to same-origin JavaScript
 * through client hints, so a real visitor is recorded as 151.0.7922.174. A
 * stripped X.0.0.0 is the reduced User-Agent string with no client hints behind
 * it — what the headless runtimes hitting this site report. Measured over
 * 1 Jul - 30 Aug 2026:
 *
 *   browserVersion ends .0.0.0   466 users / 471 sessions /  27 engaged
 *   full build number            674 users / 1136 sessions / 764 engaged
 *
 * So the signature is ~94% junk, and it is NOT free: roughly 0.45 genuinely
 * engaged sessions a day are dropped with the bots. That trade was made
 * deliberately and is the reason every consumer of this filter must also print
 * what it removed — see automatedTrafficQuery. A silent subtraction would make
 * the report less trustworthy than the contamination it fixes.
 *
 * WHEN THIS STOPS WORKING. The signature is behavioural, not a version
 * blocklist, so it does not need editing when the bots rotate versions. It DOES
 * break if Chrome changes what it reports to same-origin JS, or if the crawlers
 * start sending client hints. The tell is the excluded cohort's engagedSessions
 * climbing away from zero — the daily email prints it for exactly that reason.
 */

/**
 * Matches the automated cohort. Used positively to count it and, wrapped in a
 * notExpression, to remove it. One definition, so the two can never disagree.
 */
export const AUTOMATED_TRAFFIC_SIGNATURE = {
  andGroup: {
    expressions: [
      { filter: { fieldName: 'browser', stringFilter: { value: 'Chrome' } } },
      {
        filter: {
          fieldName: 'browserVersion',
          stringFilter: { matchType: 'ENDS_WITH', value: '.0.0.0' },
        },
      },
    ],
  },
};

/** Metrics the disclosure line needs; engagedSessions is the drift alarm. */
const DISCLOSURE_METRICS = [
  'sessions',
  'totalUsers',
  'engagedSessions',
  'screenPageViews',
];

/**
 * Add the exclusion to a GA4 runReport body, returning a new body.
 *
 * A query that already carries a dimensionFilter is ANDed, never overwritten:
 * the checkout, funnel and unassigned-traffic sections ARE their filters, and
 * replacing one would silently widen that section to the whole property and
 * report a plausible wrong number rather than fail.
 */
export function withoutAutomatedTraffic(body) {
  const exclusion = { notExpression: AUTOMATED_TRAFFIC_SIGNATURE };
  const own = body?.dimensionFilter;

  return {
    ...body,
    dimensionFilter: own
      ? { andGroup: { expressions: [own, exclusion] } }
      : exclusion,
  };
}

/**
 * The counterpart query: what the exclusion took out, so the email can say so.
 */
export function automatedTrafficQuery(dateRanges) {
  return {
    dateRanges,
    metrics: DISCLOSURE_METRICS.map((name) => ({ name })),
    dimensionFilter: AUTOMATED_TRAFFIC_SIGNATURE,
  };
}
