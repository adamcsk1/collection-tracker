import type { CollectionItemRow } from '../database/repositories/collection/collection-model';

export type TrackingSeriesTargetResult =
  { status: 200; ownerHash: string; item: CollectionItemRow } | { status: 403 | 404 };
