# Mapa Societario market-adoption playbook

## Positioning

Mapa Societario is relationship intelligence for Spanish companies: a professional starting point for understanding who is connected to whom, how a company changed over time, and which findings require documentary follow-up.

It is not positioned as a cheaper Registro Mercantil. The stronger distinction is:

- the Registro Mercantil supplies authoritative current documents;
- BORME supplies the official published notices;
- Mapa Societario turns published history into a searchable, connected research workspace.

The promise must remain credible: start free, expose sources and limitations, and charge when a decision needs a documented due-diligence report.

## Primary professional jobs

1. **Compliance, legal and procurement:** understand a supplier, client or counterparty before onboarding or renewal.
2. **Investigators and journalists:** follow a person, appointment or company across a wider corporate network.
3. **Advisers, analysts and researchers:** preserve a research path and produce a sourced deliverable for a client or internal file.

The homepage should help each audience recognize its job, but the product should keep one shared entry point: search a company or officer.

## Product journey

The intended journey is:

1. **Qualified visit** - a visitor lands on a company, officer, guide, study or homepage.
2. **Activation** - the visitor obtains the first successful graph result (`graph_activation`).
3. **Investigation** - the visitor opens nodes, expands the graph, previews data, adds notes or saves the workspace.
4. **Retention** - the visitor requests free company monitoring (`monitor_request_sent`) and confirms it (`monitor_activated`).
5. **Commercial intent** - the visitor opens a due-diligence offer (`view_item`).
6. **Checkout** - the visitor submits the order form (`begin_checkout`).
7. **Value delivered** - the report is fulfilled (`purchase`, including zero-value first reports).

Do not optimize for raw event volume. Repeated node and context-menu clicks are useful diagnostic signals, not business outcomes.

## Measurement scorecard

Review this once a week using users, not event count, unless the metric explicitly says otherwise.

| Question | Metric |
| --- | --- |
| Are we attracting the right people? | Engaged users by landing page and source/medium |
| Do visitors reach value? | Users with `graph_activation` / users on eligible entry pages |
| Does the homepage search help? | `home_search_selection` users and their downstream `graph_activation` rate |
| Which content activates best? | `graph_activation` users by `entry_source` |
| Does the product earn a return visit? | Returning activated users and `monitor_activated` users |
| Is professional interest growing? | `view_item` users / activated users |
| Is the offer understandable? | `begin_checkout` users / `view_item` users |
| Does commercial intent complete? | `purchase` users / `begin_checkout` users |

The July 16-August 12 GA export is a useful baseline, but it is not a homepage funnel: its 513 users cover the whole property. It shows that 69 users made graph selections and 41 users clicked graph nodes, which is encouraging downstream behavior. Future decisions should use a proper funnel or exploration instead of dividing every event by all property users.

### GA4 configuration

Mark these as key events:

- `graph_activation`
- `monitor_activated`
- `purchase`

Register event-scoped custom dimensions only for parameters that answer recurring decisions:

- `entry_source` -> **Graph entry source**
- `entity_type` -> **Search entity type**
- `placement` -> **CTA placement**
- `search_origin` -> **Search origin**
- `free_report` -> **Free report**

Avoid registering every diagnostic parameter; GA4 custom-dimension space and report clarity are both finite.

## Distribution strategy

### Search

Build around professional questions rather than generic volume:

- how to check a Spanish supplier or counterparty;
- how to find current and former administrators of a Spanish company;
- how to map companies sharing directors;
- BORME vs. Registro Mercantil: which source answers which question;
- how name changes, mergers and registry transfers distort ordinary company searches;
- what BORME can and cannot reveal about shareholders and beneficial ownership.

Each page should contain a real answer, a limitation, one worked example where legally appropriate, and a direct deep link into the relevant graph search.

### Professional proof

Publish one short, source-led demonstration every two weeks. A useful format is:

1. the research question;
2. the graph path used;
3. what the BORME history established;
4. what remained unverified;
5. a link that lets the reader repeat the method.

Use neutral examples or listed-company governance studies. Do not imply misconduct from a relationship alone.

### Direct professional outreach

The first outreach audience should be small Spanish law firms, compliance consultancies, investigative journalists, procurement specialists and corporate researchers. Offer a 15-minute working demonstration based on a company they choose, not a generic sales presentation.

The question to ask after each demonstration is: "What did you still have to look up elsewhere?" Those answers should drive the next data-quality or workflow improvement.

### Retention

Free monitoring is the strongest reason to return. Surface it after a successful company search and after a report, and measure both request and email confirmation. A user who monitors a company has expressed durable professional intent even if they never buy a report that day.

## 90-day operating cadence

### Weeks 1-2: establish the baseline

- Deploy homepage search and activation measurement.
- Configure the GA4 key events and custom dimensions above.
- Create one GA4 funnel: entry page -> graph activation -> monitoring or report view -> checkout -> purchase.
- Record weekly users and rates in a simple scorecard; do not react to daily noise.

### Weeks 3-6: prove usefulness

- Conduct five professional demonstrations with people from at least three target roles.
- Publish two worked, source-led investigations.
- Improve the first-search experience based on observed hesitation and failed searches.
- Make monitoring visible immediately after a useful company result.

### Weeks 7-12: scale what activates

- Identify the landing pages and search queries that produce `graph_activation`, not merely traffic.
- Expand the two best-performing professional topics into deeper guides or studies.
- Build repeatable outreach around the strongest worked example.
- Review report-view, checkout and purchase drop-off only after there is enough volume to avoid anecdotal conclusions.

## Editorial and credibility rules

- Say "based on official BORME publications," not "official database."
- Separate a published relationship from an inference about control, responsibility or wrongdoing.
- State the coverage date and identity-matching limitation wherever a conclusion could be time-sensitive.
- Link material claims to the original source when available.
- Prefer one reproducible example over ten promotional claims.
- Never trade data quality or careful caveats for a higher click-through rate.
