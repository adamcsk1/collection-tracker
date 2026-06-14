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
  selector: 'ct-series-tracker',
  imports: [List, FormField, Autocomplete],
  templateUrl: './series-tracker.html',
  styleUrl: '../collection.css',
  providers: [
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    { provide: searchSuggestionListTypeToken, useValue: 'series-tracker' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesTracker {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly floatActions = inject(FloatActionsService);
  private readonly floatSearchTemplate = viewChild<TemplateRef<unknown>>('floatSearch');

  protected readonly searchTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly seriesTrackerDataSource = ({
    offset,
    limit,
    searchText,
    orderBy,
    orderDirection,
  }: CollectionListDataSourceRequest) =>
    this.api.searchItems(
      { ...buildStandardSearchFilters(searchText, 'series-tracker'), orderBy, orderDirection },
      offset,
      limit
    );
  protected readonly translations = {
    messageEmptySeriesTracker: computed(() => this.ngxSignalTranslate.translate('Message.EmptySeriesTracker')),
    messageAddFirstSeriesTracker: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstSeriesTracker')),
    placeholderSearchInSeriesTracker: computed(() =>
      this.ngxSignalTranslate.translate('Placeholder.SearchInSeriesTracker')
    ),
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

  protected onAddSeriesTracker(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { seriesTracker: true });
  }
}
