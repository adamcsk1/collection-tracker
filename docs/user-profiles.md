# User Profiles And Avatars

## Profile settings

Open **Settings → User** to edit your display name and upload, replace, or remove your avatar. Your username remains
your login identity; changing a display name does not change sharing permissions or collection ownership.

Display names are trimmed and limited to 80 Unicode code points. An empty name resets the display to your username,
or your share code for legacy accounts without a stored username.

Avatars appear in the desktop and mobile navigation, sharing settings and dialogs, and on received collection items.
The account button at the bottom of navigation opens Settings, About, and Logout.
The thumbnail on a received item identifies its source owner, not the person currently viewing it. The existing
shared-indicator display preference still controls that indicator. Missing or unavailable avatars show initials.

## Uploads and persistence

- Upload JPEG, PNG, or WebP images, up to 5 MiB and 25 million pixels.
- Animated or multipage images are rejected.
- The server validates the decoded image, corrects orientation, center-crops it to 256 × 256 pixels, and encodes WebP
  without the original metadata. There is no external image URL or crop-editor setting.
- Invalid uploads leave the previous avatar unchanged.
- Profile data and processed avatar bytes live in SQLite, so database backups include them. Deleting the account
  deletes its profile and avatar.

Profile data is not part of collection JSON export/import. Use a database backup to preserve it.

## API and privacy

Authenticated profile operations are:

- `GET /api/v1/users/me/profile`
- `PATCH /api/v1/users/me/profile`
- `PUT /api/v1/users/me/avatar`
- `DELETE /api/v1/users/me/avatar`

Upload requests contain raw base64 image bytes in `imageBase64`, without a data-URL prefix. JSON successes use the
normal `{ data }` envelope.

`GET /api/v1/users/{shareCode}/avatar` returns binary WebP only to the account owner or an authenticated user with an
existing sharing relationship in either direction. A share code alone does not grant access. Missing avatars and
unauthorized targets return `404`; avatar responses use private, nonpersistent HTTP caching.

The client shares authenticated image requests between visible avatar instances and keeps object URLs only for the
current session. Profile changes made in another session are visible after the relevant data is reloaded; no real-time
updates are used.

See the [OpenAPI reference](../apps/server/public/server-api.yaml) for request and response schemas.
