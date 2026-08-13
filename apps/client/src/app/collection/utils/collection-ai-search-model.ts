import type { DestroyRef, Signal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { ApiService } from '@services/api/api-service';
import type { PortalService } from '@services/portal-service';
import type { CollectionItemFiltersApiModel, CollectionListTypeModel } from '@shared/models/api-model';
import type { NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import type { FloatActionsService } from '../../main/float-actions/float-actions-service';
import type { CollectionListDataSource } from '../collection-model';
import type { CollectionState } from '../collection-store';
import type { AiSearchService } from '../search/ai-search-service';

export interface CollectionAiSearchSetupOptions {
  collectionState: NgxSimpleSignalStoreService<CollectionState>;
  aiSearch: AiSearchService;
  api: ApiService;
  portal: PortalService;
  floatActions: FloatActionsService;
  destroyRef: DestroyRef;
  listType: CollectionListTypeModel;
  queryFilters: Signal<Partial<CollectionItemFiltersApiModel>>;
  forceStandardSearch?: Signal<boolean>;
  placeholder: Signal<string>;
  aiAvailable: Signal<boolean>;
}

export interface CollectionAiSearchSetup {
  dataSource: CollectionListDataSource;
  aiSearchPromptTextField: FieldTree<string>;
  aiFilterActive: Signal<boolean>;
  clearAiFilterOnStandardSearch: () => void;
  openAiSearchDialog: () => void;
  checkAiAvailableOnOpen: () => void;
}
