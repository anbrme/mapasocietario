# Homepage-to-graph search funnel

The web app sends a privacy-conscious GA4 funnel for understanding whether visitors who reach the graph discover and use its search. Company names, officer names, and typed search text are **not** sent to GA4.

## Events

| Step | GA4 event | Meaning |
| --- | --- | --- |
| 1 | `home_graph_click` | A visitor clicked a homepage graph CTA. Use `placement` to compare `hero`, `demo`, `snapshot`, and `bookmark`. |
| 2 | `graph_view` | The graph loaded. `entry_source` identifies the route into it and `has_prefilled_search` distinguishes deep links. |
| 3 | `graph_search_focus` | The visitor focused the main search field for the first time. `time_to_focus_ms` measures discoverability. |
| 4 | `graph_search_typing_started` | The visitor typed into the field for the first time. `time_to_type_ms` measures time to first use. |
| 5 | `graph_search_suggestions` | The first autocomplete response returned. It records result state and aggregate suggestion counts, never the query. |
| 6 | `graph_search_selection` | The visitor selected a company/person suggestion or used the Search button. |
| 7 | `graph_search_result` | The selected or deep-linked search succeeded, returned no match, encountered maintenance, or failed. |

Returning visitors automatically redirected from the homepage also emit `home_graph_auto_redirect`.

## Entry sources

Homepage links add a `source` parameter so the graph can report:

- `home_hero`
- `home_demo`
- `home_snapshot`
- `home_bookmark`
- `returning_home_redirect`
- `register_guide`
- `direct` for visits without a recognized source

The source value is validated before it is sent to GA4.

## GA4 setup

In **Admin → Data display → Custom definitions**, create event-scoped custom dimensions for:

- `entry_source`
- `placement`
- `entity_type`
- `selection_method`
- `search_origin`
- `result_state`

Create custom metrics for the numeric parameters you want in reports:

- `time_to_focus_ms`
- `time_to_type_ms`
- `time_to_suggestions_ms`
- `time_to_selection_ms`
- `suggestion_count`
- `result_count`

Then create a GA4 Funnel exploration using:

1. `graph_view`
2. `graph_search_focus`
3. `graph_search_typing_started`
4. `graph_search_selection`
5. `graph_search_result` filtered to `result_state = success`

Break the funnel down by `entry_source`. The clearest search-discoverability signals are the percentage of `graph_view` users who reach `graph_search_focus`, the percentage who begin typing, and the time from graph view to those events.

GA4 custom definitions start reporting from the time they are created. The events themselves can be checked immediately after deployment in Realtime and DebugView.
