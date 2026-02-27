import { CollectionItemModel } from '@client/collection/collection-model';

export function searchCollection(
  collection: ReadonlyArray<CollectionItemModel>,
  limit: number,
  matcher: (item: CollectionItemModel, results: Set<string>) => void
): Set<string> {
  const results = new Set<string>();
  for (const item of collection) {
    matcher(item, results);
    if (results.size >= limit) break;
  }
  return results;
}
