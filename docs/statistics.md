# Statistics

The lazy-loaded `/statistics` page separates personal activity from collection composition. Each view is a deferred
standalone component with its own signal store. Chart.js is not required: labeled HTML/CSS bars expose counts directly
and remain readable without hover, canvas, animation, or color interpretation.

## My year

The current calendar year is selected initially. Use This year, Last year, or a four-digit year and the media chips.
Summary buttons show matching titles alphabetically, loaded in signed cursor pages of 50. Monthly completion bars filter
the same list; All months clears that filter. Monthly bars stay collapsed until requested so titles remain primary.
Clicking a title lazy-loads the existing item dialog. Unchanged dialogs preserve loaded pages; changes refresh the loaded
depth without resetting filters, with heading focus fallback if the originating title no longer matches.

- **Planned for the selected year:** edit any existing title and set its optional Planned year. Clear it to remove the
  plan. Plans belong to list entries, include completed titles, and are counted once per canonical/exact identity within
  each year. Same-owner tracking copies retain the plan; copies from another owner do not adopt their plan. Editing a
  plan on one list does not rewrite other list entries or infer intent from Up next, wishlist, or release year.
- **Completed:** uses the tracking entry's saved completion date. Year/month boundaries use the stored calendar date;
  release year is unrelated. Entries without a saved completion date cannot be assigned to a past year.
- **Currently in progress:** live unfinished series and tracking books/albums with positive progress, across all years.
  This is deliberately not presented as a historical snapshot.

Personal activity excludes other owners' collections. Existing completion state is not a repeat-consumption event log:
watching, reading, or listening again does not add a separate historical event. Removing/reopening tracking changes the
available completion statistics. No dates or planned years are backfilled.

## Collection

Collection totals use the existing readable folded library scope, including shared items. Total, favorites, media,
genre, and tag selections show title lists without navigating away. Release years and user rating bands are descriptive.
Genre and tag counts combine case variants and count each matching list entry once, matching the title filters.
Long breakdowns show ten rows initially and expand on demand. Status distributions describe library items using the
viewer's tracking twins; they are not counts of every tracking entry.

## API and persistence

- `GET /api/v1/collection-items/activity?year=2026&type=book` returns `{ data }` with planned, completed, live inProgress,
  and all twelve monthly counts.
- `GET /api/v1/collection-items?activityYear=2026&activityStatus=completed&activityMonth=2` returns a standard signed cursor
  page. Activity year and status must be supplied together. Month is accepted only for completed activity. Activity scope
  overrides list/shared selection; ordinary media/search/tag/genre/favorite/completion filters still apply.
- `plannedYear` is optional on ordinary create/update requests, persisted by migration `044_add_planned_year.sql`, and
  retained by export/import. Omitted update fields preserve an existing plan; `null` clears it. Valid years are integers
  from 1000 to 9999. Existing optimistic-concurrency checks apply.

The complete contract lives in [server-api.yaml](../apps/server/public/server-api.yaml).
