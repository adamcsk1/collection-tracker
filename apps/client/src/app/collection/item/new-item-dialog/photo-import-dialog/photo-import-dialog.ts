import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { applyEach, disabled, form, FormField, max, min, validate } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { Callout } from '@components/callout/callout';
import { Checkbox } from '@components/checkbox/checkbox';
import { Autocomplete } from '@components/autocomplete/autocomplete';
import { Input } from '@components/input/input';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { CollectionItemContentTypeModel, CollectionListTypeModel } from '@shared/models/api-model';
import { PHOTO_IMPORT_MAX_BYTES, PHOTO_IMPORT_MAX_PHOTOS } from '@shared/constants/photo-import-const';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { parseTagText } from '@shared/utils/collection-item-text-util';
import { normalizePhotoImportIdentifier } from '@shared/utils/photo-import-identifier-util';
import { normalizeMbid } from '@shared/utils/mbid-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom } from 'rxjs';
import { CollectionService } from '../../../collection-service';
import { TagSuggestionsProvider } from '../../item-form/suggestion/item-autocomplete-providers';
import { buildMetadataItem } from '../metadata-item-util';
import { MetadataResults } from '../metadata-results/metadata-results';
import { MetadataResultOptionModel } from '../metadata-results/metadata-results-model';
import { NewItemDialogService } from '../new-item-dialog-service';
import { PhotoImportDetailsModel, PhotoImportRowModel } from './photo-import-model';
import { initialPhotoImportState, photoImportStateToken } from './photo-import-store';

@Component({
  selector: 'ct-photo-import-dialog',
  imports: [Input, FormField, Callout, Checkbox, Autocomplete, TagSuggestionsProvider, MetadataResults],
  providers: [provideStore(initialPhotoImportState, photoImportStateToken)],
  templateUrl: './photo-import-dialog.html',
  styleUrl: './photo-import-dialog.css',
  host: { 'data-test-id': 'photo-import-component' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoImportDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly collection = inject(CollectionService);
  private readonly newItem = inject(NewItemDialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(photoImportStateToken);
  private readonly previewUrls: string[] = [];
  private readonly searchQueries = new Map<string, string>();
  protected readonly pendingSearches = signal<readonly string[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  public readonly contentType = input.required<CollectionItemContentTypeModel>();
  public readonly listType = input.required<CollectionListTypeModel>();
  public readonly targetOwnerShareCode = input<string | undefined>();
  public readonly destinationLabel = input('');
  public readonly trackingEnabled = input(false);
  protected readonly state = this.store.state;
  public readonly actions = viewChild.required<TemplateRef<unknown>>('actions');
  public readonly busy = this.state.busy;
  public readonly batchStarted = computed(() => this.state.photos().length > 0);
  public readonly hasUnfinishedWork = computed(
    () =>
      this.hasPendingPhotos() || this.state.rows().some((row) => !['added', 'exists', 'skipped'].includes(row.status))
  );
  protected readonly searchModel = signal<{ queries: string[] }>({ queries: [] });
  protected readonly searchForm = form(this.searchModel, (fields) => {
    applyEach(fields.queries, (query) => disabled(query, () => this.state.busy()));
  });
  protected readonly detailsModel = signal<Record<string, PhotoImportDetailsModel>>({});
  protected readonly detailsForm = form(this.detailsModel, (fields) => {
    applyEach(fields, (details) => {
      disabled(details.tags, () => this.state.busy());
      disabled(details.userRate, () => this.state.busy() || this.listType() !== 'library');
      min(details.userRate, 0);
      max(details.userRate, 10);
      validate(details.userRate, ({ value }) => {
        const rating = value();
        if (rating === null) return null;
        return Math.abs(rating * 10 - Math.round(rating * 10)) <= 1e-9 ? null : { kind: 'userRate' };
      });
    });
  });
  protected readonly selectedCount = computed(() => this.state.rows().filter((row) => this.canAddRow(row)).length);
  protected readonly hasPendingPhotos = computed(() =>
    this.state.photos().some((photo) => photo.status === 'ready' || photo.status === 'error')
  );
  protected readonly hasFailedPhotos = computed(() => this.state.photos().some((photo) => photo.status === 'error'));
  protected readonly translations = {
    intro: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Intro')),
    privacy: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Privacy')),
    limits: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Limits')),
    choose: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Choose')),
    start: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Start')),
    retryPhotos: computed(() => this.ngxSignalTranslate.translate('PhotoImport.RetryPhotos')),
    stop: computed(() => this.ngxSignalTranslate.translate('PhotoImport.CancelProcessing')),
    add: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Add')),
    review: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Review')),
    invalidPhotos: computed(() => this.ngxSignalTranslate.translate('PhotoImport.InvalidPhotos')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    searchHint: computed(() => this.ngxSignalTranslate.translate('PhotoImport.SearchHint')),
    retrySearch: computed(() => this.ngxSignalTranslate.translate('PhotoImport.RetrySearch')),
    resumeSearch: computed(() => this.ngxSignalTranslate.translate('PhotoImport.ResumeSearch')),
    selectedContent: computed(() => this.ngxSignalTranslate.translate('SelectedContent')),
    finished: computed(() => this.ngxSignalTranslate.translate('CollectionItemFinished')),
    copyToTrackingAsCompleted: computed(() => this.ngxSignalTranslate.translate('CopyToTrackingAsCompleted')),
    trackerUpdateError: computed(() => this.ngxSignalTranslate.translate('Toast.NewItemTrackerUpdateError')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    tagsHint: computed(() => this.ngxSignalTranslate.translate('Message.Tags')),
    userRate: computed(() => this.ngxSignalTranslate.translate('UserRate')),
    validationUserRate: computed(() => this.ngxSignalTranslate.translate('Validation.UserRate')),
    skip: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Skip')),
    restore: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Restore')),
    noMatches: computed(() => this.ngxSignalTranslate.translate('PhotoImport.NoMatches')),
    noTitles: computed(() => this.ngxSignalTranslate.translate('PhotoImport.NoTitles')),
    photoError: computed(() => this.ngxSignalTranslate.translate('PhotoImport.PhotoError')),
    searchError: computed(() => this.ngxSignalTranslate.translate('PhotoImport.SearchError')),
    addError: computed(() => this.ngxSignalTranslate.translate('PhotoImport.AddError')),
    duplicate: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Duplicate')),
    refresh: computed(() => this.ngxSignalTranslate.translate('PhotoImport.Refresh')),
    availability: computed(() => {
      const availability = this.state.availability();
      if (!availability) return this.ngxSignalTranslate.translate('PhotoImport.Checking');
      switch (availability.reason) {
        case 'available':
          return '';
        case 'not-configured':
          return this.ngxSignalTranslate.translate('PhotoImport.Availability.NotConfigured');
        case 'invalid-config':
          return this.ngxSignalTranslate.translate('PhotoImport.Availability.InvalidConfig');
        case 'unreachable':
          return this.ngxSignalTranslate.translate('PhotoImport.Availability.Unreachable');
        case 'unsupported-model':
          return this.ngxSignalTranslate.translate('PhotoImport.Availability.UnsupportedModel');
      }
    }),
    count: computed(() =>
      this.ngxSignalTranslate.translate('PhotoImport.Count', {
        completed: `${this.state.photos().filter((photo) => photo.status === 'recognized').length}`,
        total: `${this.state.photos().length}`,
      })
    ),
    selectedCount: computed(() =>
      this.ngxSignalTranslate.translate('PhotoImport.SelectedCount', { count: `${this.selectedCount()}` })
    ),
    media: computed(() =>
      this.ngxSignalTranslate.translate(
        this.contentType() === 'movie'
          ? 'Movies'
          : this.contentType() === 'series'
            ? 'Series'
            : this.contentType() === 'book'
              ? 'Books'
              : 'Music'
      )
    ),
    statuses: computed(() => ({
      ready: this.ngxSignalTranslate.translate('PhotoImport.Pending'),
      reading: this.ngxSignalTranslate.translate('PhotoImport.Reading'),
      recognized: this.ngxSignalTranslate.translate('PhotoImport.Recognized'),
      searching: this.ngxSignalTranslate.translate('PhotoImport.Searching'),
      error: this.ngxSignalTranslate.translate('PhotoImport.Error'),
      adding: this.ngxSignalTranslate.translate('PhotoImport.Adding'),
      added: this.ngxSignalTranslate.translate('PhotoImport.Added'),
      exists: this.ngxSignalTranslate.translate('PhotoImport.Exists'),
      skipped: this.ngxSignalTranslate.translate('PhotoImport.Skipped'),
    })),
  };
  public readonly canClose = async (): Promise<boolean> => {
    if (this.state.busy()) return false;
    if (!this.hasUnfinishedWork()) return true;
    return firstValueFrom(this.confirm.open(this.ngxSignalTranslate.translate('Confirm.DiscardChanges')));
  };

  constructor() {
    effect(() => {
      const queries = this.searchModel().queries;
      const busy = this.state.busy();
      untracked(() => {
        this.state.rows().forEach((row, index) => {
          const query = queries[index]?.trim() ?? '';
          const previous = this.searchQueries.get(row.id);
          this.searchQueries.set(row.id, query);
          if (previous === undefined || previous === query || ['added', 'exists', 'skipped'].includes(row.status))
            return;
          this.updateRow(row.id, { selected: null, matches: [], searched: false, status: 'ready' });
          this.pendingSearches.update((pending) => [
            ...pending.filter((id) => id !== row.id),
            ...(query ? [row.id] : []),
          ]);
        });
        clearTimeout(this.searchTimer);
        if (!busy && this.pendingSearches().length) {
          this.searchTimer = setTimeout(() => void this.searchPendingRows(), 500);
        }
      });
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.searchTimer);
      this.pendingSearches.set([]);
      for (const url of this.previewUrls) URL.revokeObjectURL(url);
    });
  }

  private async searchPendingRows(): Promise<void> {
    const searches = this.pendingSearches().map((id) => {
      const index = this.state.rows().findIndex((row) => row.id === id);
      return { id, index, query: this.searchModel().queries[index]?.trim() };
    });
    for (const { id, index, query } of searches) {
      if (this.destroyed || this.state.busy()) return;
      if (!this.pendingSearches().includes(id)) continue;
      if (this.searchModel().queries[index]?.trim() !== query) continue;
      this.pendingSearches.update((pending) => pending.filter((pendingId) => pendingId !== id));
      await this.onSearchRow(index);
    }
  }

  public async ngOnInit(): Promise<void> {
    await this.checkAvailability();
  }

  protected async checkAvailability(): Promise<void> {
    try {
      this.store.setState('availability', await firstValueFrom(this.api.getPhotoImportAvailability()));
    } catch {
      this.store.setState('availability', { available: false, reason: 'unreachable' });
    }
  }

  protected async onFilesSelected(event: Event): Promise<void> {
    if (this.state.busy() || this.state.photos().length) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (
      files.length > PHOTO_IMPORT_MAX_PHOTOS ||
      files.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          !file.size ||
          file.size > PHOTO_IMPORT_MAX_BYTES
      )
    ) {
      this.store.setState('invalidPhotos', true);
      return;
    }
    this.store.setState('invalidPhotos', false);
    this.store.setState(
      'photos',
      files.map((file) => {
        const preview = URL.createObjectURL(file);
        this.previewUrls.push(preview);
        return { id: crypto.randomUUID(), file, preview, status: 'ready' };
      })
    );
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Could not read photo.'));
          return;
        }
        resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(new Error('Could not read photo.'));
      reader.readAsDataURL(file);
    });
  }

  private updatePhoto(id: string, status: 'ready' | 'reading' | 'recognized' | 'error'): void {
    this.store.setState(
      'photos',
      this.state.photos().map((photo) => (photo.id === id ? { ...photo, status } : photo))
    );
  }

  private updateRow(id: string, changes: Partial<PhotoImportRowModel>): void {
    this.store.setState(
      'rows',
      this.state.rows().map((row) => (row.id === id ? { ...row, ...changes } : row))
    );
  }

  protected async readPhotos(): Promise<void> {
    if (this.state.busy() || !this.state.availability()?.available) return;
    this.store.setState('busy', true);
    this.store.setState('stopRequested', false);
    try {
      for (const photo of this.state.photos()) {
        if (this.destroyed || this.state.stopRequested()) break;
        if (photo.status !== 'ready' && photo.status !== 'error') continue;
        this.updatePhoto(photo.id, 'reading');
        try {
          const base64 = await this.readFile(photo.file);
          const result = await firstValueFrom(
            this.api.recognizePhoto({ contentType: this.contentType(), imageBase64: base64 })
          );
          if (this.destroyed) break;
          const rows: PhotoImportRowModel[] = result.titles.map((title) => ({
            id: crypto.randomUUID(),
            photoId: photo.id,
            photoName: photo.file.name,
            title: title.title || title.identifier || '',
            identifier: title.identifier,
            details: [title.identifier, title.contributor, title.year].filter(Boolean).join(', '),
            matches: [],
            selected: null,
            status: 'ready',
            searched: false,
          }));
          const firstIndex = this.state.rows().length;
          this.detailsModel.update((details) => ({
            ...details,
            ...Object.fromEntries(rows.map((row) => [row.id, { tags: '', userRate: null }])),
          }));
          this.store.setState('rows', [...this.state.rows(), ...rows]);
          this.searchModel.update((model) => ({
            queries: [...model.queries, ...rows.map((row) => row.identifier || row.title)],
          }));
          this.updatePhoto(photo.id, 'recognized');
          for (let index = firstIndex; index < firstIndex + rows.length; index++) {
            if (this.destroyed || this.state.stopRequested()) break;
            await this.searchRow(index);
          }
        } catch {
          this.updatePhoto(photo.id, 'error');
        }
      }
    } finally {
      this.store.setState('busy', false);
    }
  }

  protected requestStop(): void {
    clearTimeout(this.searchTimer);
    this.pendingSearches.set([]);
    this.store.setState('stopRequested', true);
  }

  protected async onSearchRow(index: number): Promise<void> {
    if (this.state.busy()) return;
    const row = this.state.rows()[index];
    if (row) this.pendingSearches.update((pending) => pending.filter((id) => id !== row.id));
    this.store.setState('busy', true);
    this.store.setState('stopRequested', false);
    try {
      await this.searchRow(index);
    } finally {
      this.store.setState('busy', false);
    }
  }

  private async searchRow(index: number): Promise<void> {
    const row = this.state.rows()[index];
    let query = this.searchModel().queries[index]?.trim();
    if (!row || !query || ['added', 'exists', 'skipped'].includes(row.status)) return;
    this.searchQueries.set(row.id, query);
    const isCurrent = () => !this.destroyed && this.searchModel().queries[index]?.trim() === query;
    const fallbackTitle = query === row.identifier ? row.title : undefined;
    this.updateRow(row.id, { status: 'searching', selected: null, matches: [] });
    try {
      let matches = await this.findMatches(query);
      if (!isCurrent()) return;
      if (!matches.length && fallbackTitle && fallbackTitle !== query) {
        if (this.state.stopRequested()) {
          this.updateRow(row.id, { status: 'ready', searched: false });
          return;
        }
        query = fallbackTitle;
        this.searchQueries.set(row.id, query);
        this.searchModel.update((model) => ({
          queries: model.queries.map((value, queryIndex) => (queryIndex === index ? fallbackTitle : value)),
        }));
        matches = await this.findMatches(fallbackTitle);
      }
      if (!isCurrent()) return;
      this.updateRow(row.id, {
        matches,
        status: 'ready',
        searched: true,
      });
    } catch {
      if (isCurrent()) this.updateRow(row.id, { status: 'error', searched: true });
    }
  }

  private async findMatches(query: string): Promise<ExternalMetadataItemModel[]> {
    const contentType = this.contentType();
    const provider = contentType === 'book' ? 'openlibrary' : contentType === 'album' ? 'musicbrainz' : 'omdb';
    const identifier = normalizePhotoImportIdentifier(query, contentType);
    let matches: ExternalMetadataItemModel[];
    if (identifier && (contentType !== 'album' || normalizeMbid(identifier))) {
      try {
        matches = [
          await firstValueFrom(
            this.api.getExternalMetadataItem(
              { externalIdentitySource: provider === 'omdb' ? 'imdb' : provider, externalIdentityId: identifier },
              { suppressErrorAlert: true }
            )
          ),
        ];
      } catch (error) {
        if (!(error instanceof HttpErrorResponse) || error.status !== 404) throw error;
        matches = [];
      }
    } else {
      matches = (
        await firstValueFrom(
          this.api.searchExternalMetadata({ s: identifier ?? query, provider }, { suppressErrorAlert: true })
        )
      ).results;
    }
    return matches.filter((match) => match.contentType === contentType);
  }

  protected onSelect(index: number, match: ExternalMetadataItemModel): void {
    const row = this.state.rows()[index];
    if (this.state.busy() || !row || ['added', 'exists'].includes(row.status) || this.isDuplicate(match, row.id))
      return;
    this.updateRow(row.id, { selected: match, status: 'ready' });
  }

  protected onSkip(index: number): void {
    const row = this.state.rows()[index];
    if (this.state.busy() || !row || ['added', 'exists'].includes(row.status)) return;
    const restore = row.status === 'skipped';
    this.pendingSearches.update((pending) => pending.filter((id) => id !== row.id));
    this.updateRow(row.id, {
      status: restore ? 'ready' : 'skipped',
      selected: null,
      searched: row.status === 'error' && !row.selected ? false : row.searched,
    });
    if (restore && !row.searched && this.searchModel().queries[index]?.trim()) void this.onSearchRow(index);
  }

  protected canAddRow(row: PhotoImportRowModel): boolean {
    return this.showRowOptions(row) && !this.detailsForm[row.id]?.().invalid();
  }

  protected showRowOptions(row: PhotoImportRowModel): boolean {
    return !!row.selected && (row.status === 'ready' || row.status === 'error');
  }

  protected showTrackingOptions(row: PhotoImportRowModel): boolean {
    return this.trackingEnabled() && this.listType() === 'library' && this.showRowOptions(row);
  }

  protected onTrackingOptionChange(
    index: number,
    option: 'finished' | 'copyToTrackingAsCompleted',
    value: boolean | null
  ): void {
    const row = this.state.rows()[index];
    if (!row || this.state.busy() || !this.showTrackingOptions(row)) return;
    this.updateRow(row.id, { [option]: !!value });
  }

  protected isDuplicate(match: ExternalMetadataItemModel, rowId: string): boolean {
    return this.state
      .rows()
      .some(
        (row) =>
          row.id !== rowId &&
          row.selected?.provider === match.provider &&
          row.selected.providerItemId === match.providerItemId
      );
  }

  protected hasRecognizedRows(photoId: string): boolean {
    return this.state.rows().some((row) => row.photoId === photoId);
  }

  protected matchOptions(row: PhotoImportRowModel): MetadataResultOptionModel[] {
    return row.matches.map((match) => {
      const duplicate = this.isDuplicate(match, row.id);
      return {
        value: `${match.provider}/${match.providerItemId}`,
        text: match.title,
        poster: match.poster,
        year: match.year,
        actors: match.actors,
        contentType: match.contentType,
        disabled: duplicate,
        hint: duplicate ? this.translations.duplicate() : undefined,
      };
    });
  }

  protected onMatchSelected(index: number, option: MetadataResultOptionModel): void {
    const match = this.state
      .rows()
      [index]?.matches.find((match) => `${match.provider}/${match.providerItemId}` === option.value);
    if (match) this.onSelect(index, match);
  }

  protected async addSelected(): Promise<void> {
    if (this.state.busy() || !this.selectedCount()) return;
    const rows = this.state.rows().filter((row) => this.canAddRow(row));
    this.store.setState('busy', true);
    this.store.setState('stopRequested', false);
    try {
      for (const row of rows) {
        if (this.destroyed || this.state.stopRequested()) break;
        if (!this.canAddRow(row) || !row.selected) continue;
        this.updateRow(row.id, { status: 'adding' });
        try {
          const metadata = await firstValueFrom(
            this.api.getExternalMetadataItem(
              {
                externalIdentitySource: row.selected.provider,
                externalIdentityId: row.selected.providerItemId,
              },
              { suppressErrorAlert: true }
            )
          );
          if (metadata.contentType !== this.contentType() || !metadata.providerItemId) throw new Error();
          const existing = await firstValueFrom(
            this.api.collectionItemExists(
              metadata.provider,
              metadata.providerItemId,
              this.targetOwnerShareCode(),
              this.listType(),
              metadata.externalIds,
              { suppressErrorAlert: true }
            )
          ).catch((error: unknown) => {
            // Selected-item shares can allow Add without exposing the owner's existing items.
            if (error instanceof HttpErrorResponse && error.status === 403) return null;
            throw error;
          });
          if (existing?.exists) {
            this.updateRow(row.id, { status: 'exists' });
            continue;
          }
          const response = await firstValueFrom(
            this.api.create(
              {
                ...buildMetadataItem(metadata),
                tags: parseTagText(this.detailsModel()[row.id]?.tags ?? ''),
                userRate: this.listType() === 'library' ? (this.detailsModel()[row.id]?.userRate ?? null) : null,
              },
              this.targetOwnerShareCode(),
              this.listType(),
              {
                suppressErrorAlert: true,
              }
            )
          );
          const result = await firstValueFrom(
            this.newItem.applySideEffects({
              collectionItem: response.item,
              listType: this.listType(),
              finished: this.showTrackingOptions(row) && !!row.finished,
              copyToTrackingAsCompleted: this.showTrackingOptions(row) && !!row.copyToTrackingAsCompleted,
              targetOwnerShareCode: this.targetOwnerShareCode(),
              selectedContentIsMovie: metadata.contentType === 'movie',
              selectedContentIsSeries: metadata.contentType === 'series',
            })
          );
          this.updateRow(row.id, { status: 'added', trackerUpdateFailed: result.trackerUpdateFailed });
          this.collection.addCollectionItem(result.collectionItem, true);
          if (result.finishedItem) this.collection.addCollectionItem(result.finishedItem, true);
          if (result.trackingItem) this.collection.addCollectionItem(result.trackingItem, true);
        } catch (error) {
          this.updateRow(row.id, {
            status: error instanceof HttpErrorResponse && error.status === 409 ? 'exists' : 'error',
          });
        }
      }
    } finally {
      this.collection.triggerReload();
      this.store.setState('busy', false);
    }
  }
}
