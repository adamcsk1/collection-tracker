import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionListDataSourceRequest } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { SearchSuggestionService, searchSuggestionListTypeToken } from '../library/search/search-suggestion-service';
import { List } from '../list/list';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { buildStandardSearchFilters, setupStandardCollectionSearch } from '../utils/collection-search-filter-util';

@Component({
  selector: 'ct-watch-later',
  imports: [List, FormField, Autocomplete],
  templateUrl: './watch-later.html',
  styleUrl: '../collection.css',
  providers: [
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    { provide: searchSuggestionListTypeToken, useValue: 'watch-later' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchLater {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly floatActions = inject(FloatActionsService);
  private readonly floatSearchTemplate = viewChild<TemplateRef<unknown>>('floatSearch');

  protected readonly searchTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly watchLaterDataSource = ({ offset, limit, searchText }: CollectionListDataSourceRequest) =>
    this.api.searchItems(buildStandardSearchFilters(searchText, 'watch-later'), offset, limit);
  protected readonly translations = {
    messageEmptyWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.EmptyWatchLater')),
    messageAddFirstWatchLater: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstWatchLater')),
    placeholderSearchInCollection: computed(() => this.ngxSignalTranslate.translate('Placeholder.SearchInCollection')),
  };

  constructor() {
    setupStandardCollectionSearch({
      collectionState: this.collectionState,
      searchTextModel: this.searchTextModel,
      floatActions: this.floatActions,
      floatSearchTemplate: this.floatSearchTemplate,
      destroyRef: this.destroyRef,
    });
  }

  protected onAddWatchLater(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { watchLater: true });
  }
}
