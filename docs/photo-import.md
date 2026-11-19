# Photo import

The **From photos** tab in Add recognizes titles and printed identifiers from cover, spine or label photos, then queries the existing metadata providers. A batch uses
one media type only: movies, series, books, or music. It never guesses a mixed collection or adds an unreviewed AI result.

## Configure vision

Vision uses its own optional `ollama-vision.config.json` in the active server data folder, independent of
`ollama.config.json`, its text model, and its embedding model. Missing configuration disables only photo import.

1. Install a vision model on your Ollama server: `ollama pull gemma3:4b`.
2. Copy [`apps/server/scripts/ollama-vision.config.json`](../apps/server/scripts/ollama-vision.config.json) into the active
   data folder (`.data` by default; `/data` inside the app container).
3. Set `host` to the Ollama URL reachable **from the server process**. Local development can use
   `http://127.0.0.1:11434`. Docker with host Ollama usually needs `http://host.docker.internal:11434` and an Ollama listener
   reachable from that container. Do not expose an unauthenticated Ollama listener to the public Internet.
4. Open the **From photos** tab to check availability. Config changes are read on the next availability or recognition request; restart is
   not required. Existing drafts are local to the open dialog, not persisted across reloads.

The example uses `gemma3:4b`, an image-capable variant listed by Ollama. Smaller Gemma 3 text-only variants are unsuitable.
The model download is approximately 3.4 GB; runtime RAM/VRAM requirements depend on context, quantization and hardware.
Test recognition quality with your actual photos before relying on it. No model is installed automatically.

Supported configuration fields:

- `host`: HTTP(S) Ollama base URL, without embedded credentials.
- `model`: an installed model whose `/api/show` capabilities include `vision`.
- `options`: scalar Ollama generation options, merged over `temperature: 0` and `num_predict: 4096`.
- Optional `keep_alive`: Ollama duration string or numeric value. Omitted means Ollama's normal behavior.

Malformed configuration, missing/non-vision models and unreachable Ollama each produce a separate availability reason.
They do not prevent the application from starting or affect ordinary Add and AI search.

## Review workflow

1. Select the media type and destination in Add, then open **From photos**. These choices stay fixed for the batch.
2. Select up to ten JPEG, PNG or WebP photos and start recognition. Each photo can contain several items of the same type.
3. Review extracted titles or identifiers and matching provider results. Correct the search text when necessary and select a match or skip.
   Changed queries search automatically after a 500 ms pause. Empty queries clear matches; failed searches offer **Retry search**.
   **Resume search** handles rows left unsearched after stopping a batch. Restoring an unsearched or failed-search row searches it again.
4. Use **Add selected**. Full metadata is fetched through the existing provider service; IMDb IDs, normalized ISBNs and
   MusicBrainz release identities come from metadata, never from an AI guess.
5. Retry failures. Completed photos are not recognized again; successfully added or existing items are not submitted again.
   Before every create attempt, the normal existence endpoint checks the destination, including after an ambiguous failure.

Selecting a match exposes per-item **Tags**, with the usual tag suggestions, and **User rating** for Library additions.
Ratings are optional, from 0 to 10 with at most one decimal place. Each row keeps its own values through searches,
skipping and retries; invalid ratings prevent that row from being added. Skipped or unselected rows hide these inputs.

Readable identifiers take priority over titles: IMDb IDs for movies/series, ISBN-10 or ISBN-13 for books, and MusicBrainz
release IDs or printed UPC/EAN digits for music. ISBNs are normalized to ISBN-13; ISBN and barcode checksums are validated.
IMDb, ISBN and MusicBrainz release IDs use exact item lookup; barcodes use the provider's barcode search. When no matching
item is found, a readable title is tried instead. Provider errors remain retryable rather than silently triggering fallback.
An identifier-only photo does not need a readable title. Results still require selection before adding; vision never creates
an item directly. Barcode stripes are not decoded: include legible printed digits, and verify the suggested release.

For Library additions with tracking enabled, selecting a movie exposes **Finished** and selecting a series exposes
**Copy to tracking as completed**. Each row keeps its own choice. Skipped or unselected rows show neither option.
These use the same tracking updates as ordinary Add. If a tracking update fails after creation, the row stays added and
shows a warning; manage its tracking separately rather than adding the item again.

Choose Type and Library before selecting photos; both stay locked for the batch. The tab remains available when vision
is unavailable and shows configuration guidance without blocking Search or Manual. Search and Manual drafts are preserved.

Stopping finishes the current operation and prevents the next one. Closing or leaving the photo tab is blocked while an
operation runs; after it stops, either action asks before discarding unfinished review work. Use the parent dialog's normal
close/back behavior; there is no separate Done button. Successful collection additions remain saved.

## Limits and privacy

- Each photo is limited to 10 MiB decoded and 50 megapixels. Animated and multipage files are rejected.
- The server validates actual decoded image content, strips metadata, corrects orientation and downsizes to at most
  2400 × 2400 before sending it to Ollama. No source photo is written to the database, filesystem cache or application logs.
- Photos are sent to the configured Ollama host. That host may have its own logging policy.
- One vision recognition runs at a time per server. Busy requests return `429` and can be retried.
- Inference times out after 180 seconds. The dedicated nginx upload route allows 14 MiB for base64 JSON overhead;
  reverse proxies in front of nginx must permit that request size and an appropriate timeout too.
- Metadata searches and collection creates retain existing authentication, sharing permissions, duplicate constraints
  and rate limits. Vision suggestions are untrusted data and always require human review.

## API

- `GET /api/v1/ai/vision/availability`: `{ data: { available, reason } }`.
- `POST /api/v1/ai/vision/recognize`: `{ contentType, imageBase64 }`; raw base64, not a data URL.
  Returns `{ data: { titles: [{ title, year, contributor, identifier? }] } }`, with at most 50 suggestions per photo.
  `identifier` is included only when valid for the selected media type; `title` may be empty for identifier-only results.
- Errors use the existing RFC 9457 problem-details contract. See the [OpenAPI reference](../apps/server/public/server-api.yaml).
