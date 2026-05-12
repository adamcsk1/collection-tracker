import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { LinkButton } from '@components/link-button/link-button';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_TAGS, WATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { parseGenreText, parseTagText } from '@shared/utils/collection-item-text-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { map, mergeMap, of } from 'rxjs';
import { mainStateToken } from '../../main/main-store';
import { CollectionItemModel } from '../collection-model';
import { CollectionService } from '../collection-service';
import { TagSuggestionService } from '../new-item-dialog/suggestion/tag-suggestion-service';
import { getProxyImageUrl } from '../utils/proxy-image-url-util';
import { GenreSuggestionService } from './suggestion/genre-suggestion-service';

@Component({
  selector: 'ct-item-dialog',
  imports: [DialogShell, Autocomplete, LinkButton],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.css',
  providers: [TagSuggestionService, GenreSuggestionService],
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialog implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly portal = inject(PortalService);
  private readonly mainState = inject(mainStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lastSavedItem = signal<CollectionItemChangeApiModel | null>(null);
  protected readonly translations = {
    titleCollectionItem: computed(() => this.ngxSignalTranslate.translate('Title.CollectionItem')),
    labelTitle: computed(() => this.ngxSignalTranslate.translate('Label.Title')),
    labelIMDbId: computed(() => this.ngxSignalTranslate.translate('Label.IMDbId')),
    labelYear: computed(() => this.ngxSignalTranslate.translate('Label.Year')),
    labelIMDbRate: computed(() => this.ngxSignalTranslate.translate('Label.IMDbRate')),
    labelImageUrl: computed(() => this.ngxSignalTranslate.translate('Label.ImageUrl')),
    altImageExample: computed(() => this.ngxSignalTranslate.translate('Alt.ImageExample')),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    hintSeparateGenres: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateGenres')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    hintSeparateTags: computed(() => this.ngxSignalTranslate.translate('Hint.SeparateTags')),
    actors: computed(() => this.ngxSignalTranslate.translate('Actors')),
    plot: computed(() => this.ngxSignalTranslate.translate('Plot')),
    fallbackUnknownYear: computed(() => this.ngxSignalTranslate.translate('Fallback.UnknownYear')),
    fallbackNotAvailable: computed(() => this.ngxSignalTranslate.translate('Fallback.NotAvailable')),
    links: computed(() => this.ngxSignalTranslate.translate('Links')),
    linkYouTubeTrailer: computed(() => this.ngxSignalTranslate.translate('Link.YouTubeTrailer')),
    linkWebSearch: computed(() => this.ngxSignalTranslate.translate('Link.WebSearch')),
    readOnly: computed(() => this.ngxSignalTranslate.translate('ReadOnly')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    edit: computed(() => this.ngxSignalTranslate.translate('Edit')),
    markAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAsUnwatched')),
    markAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAsWatched')),
    delete: computed(() => this.ngxSignalTranslate.translate('Delete')),
  };
  protected readonly tagSuggestionService = inject(TagSuggestionService);
  protected readonly genreSuggestionService = inject(GenreSuggestionService);
  protected readonly draftItem = signal<CollectionItemChangeApiModel>({
    image: '',
    title: '',
    genre: [],
    IMDbId: '',
    tags: [],
    year: null,
    rate: '',
    actors: '',
    plot: '',
  });
  protected readonly genreText = computed(() => this.draftItem().genre.join(', '));
  protected readonly tagsText = computed(() => this.draftItem().tags.join(' '));
  protected readonly editMode = signal(false);
  protected readonly posterImageFailed = signal(false);
  protected readonly permissionUpdate = computed(() => this.mainState.state.permissions().update);
  protected readonly permissionDelete = computed(() => this.mainState.state.permissions().delete);
  protected readonly watched = computed(() => this.collectionItem().tags.includes(WATCHED_TAG));
  protected readonly draftImageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.draftItem().image)
  );
  protected readonly imageUrl = computed(() =>
    getProxyImageUrl(this.apiState.state.apiUrl(), this.collectionItem().image)
  );
  protected readonly trailerUrl = computed(() => {
    const item = this.collectionItem();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} ${item.year ?? ''} trailer`.trim())}`;
  });
  protected readonly imdbUrl = computed(() => `https://www.imdb.com/title/${this.collectionItem().IMDbId}/`);
  protected readonly webSearchUrl = computed(() => {
    const item = this.collectionItem();
    return `https://duckduckgo.com/?q=${encodeURIComponent(`${item.title} ${item.year ?? ''}`.trim())}`;
  });
  public readonly collectionItem = model.required<CollectionItemModel>();

  public ngOnInit(): void {
    const item = toCollectionItemChange(this.collectionItem());
    this.draftItem.set(item);
    this.lastSavedItem.set(item);
  }

  protected updateDraft<K extends keyof CollectionItemChangeApiModel>(
    key: K,
    value: CollectionItemChangeApiModel[K]
  ): void {
    this.draftItem.update((item) => ({ ...item, [key]: value }));
  }

  protected updateGenre(value: string): void {
    this.updateDraft('genre', parseGenreText(value));
  }

  protected updateTags(value: string): void {
    this.updateDraft('tags', parseTagText(value));
  }

  protected updateYear(value: string): void {
    this.updateDraft('year', value ? Number(value) || null : null);
  }

  protected onDelete(): void {
    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Delete', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            return this.api.delete(this.collectionItem().IMDbId, this.collectionItem().hash).pipe(map(() => confirmed));
          } else return of(confirmed);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.DeleteItem'));
          this.collectionService.deleteCollectionItem(this.collectionItem().IMDbId);
          this.collectionService.triggerReload();
          this.portal.close();
        }
      });
  }

  protected onEdit(): void {
    this.editMode.set(true);
  }

  protected onReadOnly(): void {
    const lastSavedItem = this.lastSavedItem();
    if (lastSavedItem) this.draftItem.set(lastSavedItem);
    this.editMode.set(false);
  }

  protected onPosterImageError(): void {
    this.posterImageFailed.set(true);
  }

  protected onSaveChanges(): void {
    const item = this.draftItem();
    if (!item.title.trim() || !item.IMDbId.trim()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MissingRequiredField'));
      return;
    }

    const hasVirtualTag = item.tags.some((tag) => VIRTUAL_TAGS.includes(tag));
    if (hasVirtualTag) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.VirtualTagNotAllowed'));
      return;
    }

    const hasTypeTag = item.tags.some((tag) => tag === '#movie' || tag === '#series');
    if (!hasTypeTag) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MissingTypeTag'));
      return;
    }

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.Change', { name: this.collectionItem().title }))
      .pipe(
        mergeMap((confirmed) => {
          if (confirmed) {
            return this.api
              .update(this.collectionItem().IMDbId, item, this.collectionItem().hash)
              .pipe(map((result) => ({ confirmed, item: result.item })));
          } else return of({ confirmed, item: null });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ confirmed, item }) => {
        if (confirmed && item) {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.EditItem'));
          this.collectionService.updateCollectionItem(this.collectionItem().IMDbId, item);
          this.collectionService.triggerReload();
          this.collectionItem.set(item);
          this.lastSavedItem.set(toCollectionItemChange(item));
          this.posterImageFailed.set(false);
          this.onReadOnly();
        }
      });
  }

  protected onMarkAsWatched(): void {
    if (this.draftItem().tags.includes(WATCHED_TAG)) return;
    this.updateDraft('tags', [...this.draftItem().tags, WATCHED_TAG]);
    this.onSaveChanges();
  }

  protected onMarkAsUnwatched(): void {
    this.updateDraft(
      'tags',
      this.draftItem().tags.filter((tag) => tag !== WATCHED_TAG)
    );
    this.onSaveChanges();
  }
}
