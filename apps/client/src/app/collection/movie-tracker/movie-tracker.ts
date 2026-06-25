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
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { map } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionListDataSourceRequest } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { SearchSuggestionService, searchSuggestionListTypeToken } from '../library/search/search-suggestion-service';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { List } from '../list/list';
import { buildStandardSearchFilters, setupStandardCollectionSearch } from '../utils/collection-search-filter-util';

@Component({
  selector: 'ct-movie-tracker',
  imports: [List, FormField, Autocomplete],
  templateUrl: './movie-tracker.html',
  styleUrl: '../collection.css',
  providers: [
    { provide: AutocompleteService, useClass: SearchSuggestionService },
    { provide: searchSuggestionListTypeToken, useValue: 'movie-tracker' },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieTracker {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly floatActions = inject(FloatActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly floatSearchTemplate = viewChild<TemplateRef<unknown>>('floatSearch');

  protected readonly querySearch = toSignal(
    this.route.queryParamMap.pipe(map((queryParamMap) => queryParamMap.get('search')?.trim() ?? '')),
    { initialValue: this.route.snapshot.queryParams['search']?.trim?.() ?? '' }
  );
  protected readonly searchTextModel = signal('');
  protected readonly searchTextField = form(this.searchTextModel);
  protected readonly movieTrackerDataSource = ({
    offset,
    limit,
    searchText,
    orderBy,
    orderDirection,
  }: CollectionListDataSourceRequest) =>
    this.api.searchItems(
      { ...buildStandardSearchFilters(searchText, 'movie-tracker'), orderBy, orderDirection },
      offset,
      limit
    );
  protected readonly translations = {
    messageEmptyMovieTracker: computed(() => this.ngxSignalTranslate.translate('Message.EmptyMovieTracker')),
    messageAddFirstMovieTracker: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstMovieTracker')),
    placeholderSearchInMovieTracker: computed(() =>
      this.ngxSignalTranslate.translate('Placeholder.SearchInMovieTracker')
    ),
  };

  constructor() {
    setupStandardCollectionSearch({
      collectionState: this.collectionState,
      searchTextModel: this.searchTextModel,
      floatActions: this.floatActions,
      floatSearchTemplate: this.floatSearchTemplate,
      destroyRef: this.destroyRef,
      initialSearchText: this.querySearch(),
    });
  }

  protected onAddMovieTracker(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { movieTracker: true });
  }
}
