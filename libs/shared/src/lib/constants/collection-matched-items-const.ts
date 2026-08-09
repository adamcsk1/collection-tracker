/** One identity can produce three canonical IDs and two identity-ID binds. */
export const MAX_COLLECTION_MATCHED_ITEM_IDENTITIES = 6_000;
export const MAX_COLLECTION_MATCHED_FILTER_TAGS = 100;
export const MAX_COLLECTION_MATCHED_FILTER_GENRES = 100;

/** Stay below SQLite's default 32,766 bind limit, including query overhead. */
export const COLLECTION_MATCHED_SQLITE_BIND_BUDGET = 30_200;
export const COLLECTION_MATCHED_IDENTITY_IN_CHUNK_SIZE = 400;
export const COLLECTION_MATCHED_ALIAS_OWNER_IN_CHUNK_SIZE = 400;
