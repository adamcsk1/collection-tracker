import { Router } from '@angular/router';
import { CollectionListTypeModel } from '@shared/models/api-model';
import { CollectionItemModel } from '@shared/models/collection-item-model';
import { ExternalItemIdentityModel } from '@shared/models/external-metadata-provider-model';
import { isExternalItemIdentitySourceName } from '@shared/utils/external-metadata-provider-util';
import { COLLECTION_LIST_ROUTE_BY_TYPE } from '../collection-list-route-const';

export const COLLECTION_ITEM_QUERY_PARAM = 'item';

export const buildCollectionItemQueryValue = (
  item: Pick<CollectionItemModel, 'externalProvider' | 'externalItemId'>
): string => `${item.externalProvider}:${item.externalItemId}`;

export const parseCollectionItemQueryValue = (value: string | null | undefined): ExternalItemIdentityModel | null => {
  if (!value) return null;
  const separatorIndex = value.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;
  const source = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1).trim();
  if (!isExternalItemIdentitySourceName(source) || !id) return null;
  return { source, id };
};

export const setCollectionItemQuery = (
  router: Router,
  item: Pick<CollectionItemModel, 'externalProvider' | 'externalItemId' | 'listType'>,
  currentListType?: CollectionListTypeModel
): void => {
  const itemValue = buildCollectionItemQueryValue(item);
  if (currentListType && item.listType !== currentListType) {
    void router.navigate(['/collection', COLLECTION_LIST_ROUTE_BY_TYPE[item.listType]], {
      queryParams: { [COLLECTION_ITEM_QUERY_PARAM]: itemValue },
    });
    return;
  }

  void router.navigate([], {
    queryParams: { [COLLECTION_ITEM_QUERY_PARAM]: itemValue },
    queryParamsHandling: 'merge',
  });
};

export const clearCollectionItemQuery = (router: Router, replaceUrl = false): void => {
  void router.navigate([], {
    queryParams: { [COLLECTION_ITEM_QUERY_PARAM]: null },
    queryParamsHandling: 'merge',
    replaceUrl,
  });
};
