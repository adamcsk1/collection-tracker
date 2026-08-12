# Default Collection Owners

Recipients configure default destinations from an incoming share's access dialog. Each default applies to one exact
list and content scope and appears only when that owner grants Add permission for that scope. Missing, revoked, or
otherwise invalid defaults fall back to the recipient's own collection.

The server stores relational owner identities and exposes share codes only through the API. Removing Add permission,
revoking a share, or deleting an owner removes affected defaults. Migration 038 converts valid legacy default-library
settings into separate movie and series defaults.

Settings API requests replace the complete `defaultCollectionOwners` array. Export schema version 11 uses this array;
imports still accept versions 9 and 10, including the legacy `defaultLibraryOwnerShareCode` setting.
