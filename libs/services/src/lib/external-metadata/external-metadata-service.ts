import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ExternalMetadataItemModel,
  ExternalMetadataReferenceModel,
  ExternalMetadataSelectDataModel,
} from '@shared/models/external-metadata-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { getIMDbId } from '@shared/utils/imdb-id-util';
import { catchError, EMPTY, finalize, Observable, of, Subscription } from 'rxjs';
import { AlertService } from '../alert-service';
import { ApiService } from '../api/api-service';

@Injectable()
export class ExternalMetadataService {
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private searchText = '';
  private directImdbId: string | null = null;
  private directImdbItem: { reference: string; item: ExternalMetadataItemModel } | null = null;
  private searchSubscription: Subscription | null = null;
  private searchRequestId = 0;
  private provider: ExternalMetadataProviderNameModel | null = null;
  private readonly _matchedContent = signal<ExternalMetadataSelectDataModel[]>([]);
  private readonly _matchedReferences = signal<Record<string, ExternalMetadataReferenceModel>>({});
  private readonly _selectedContent = signal<ExternalMetadataItemModel | null>(null);
  private readonly _completedSearchText = signal('');
  private readonly _searchPending = signal(false);
  public readonly matchedContent = this._matchedContent.asReadonly();
  public readonly selectedContent = this._selectedContent.asReadonly();
  public readonly completedSearchText = this._completedSearchText.asReadonly();
  public readonly searchPending = this._searchPending.asReadonly();
  public readonly selectedContent$ = toObservable(this.selectedContent);

  public getMatchedContents(searchText: string, provider: ExternalMetadataProviderNameModel | null = null): void {
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = null;
    this.searchText = searchText;
    this.provider = provider;
    this.directImdbId = provider === 'openlibrary' ? null : getIMDbId(this.searchText) || null;
    this.directImdbItem = null;
    this.searchRequestId++;
    this._completedSearchText.set('');
    this._matchedContent.set([]);
    this._matchedReferences.set({});

    if (!searchText.trim()) {
      this._searchPending.set(false);
      return;
    }

    this._searchPending.set(true);
    this.fetchExternalMetadata();
  }

  public getSelectedContent(selectedExternalMetadataValue: string): Observable<ExternalMetadataItemModel | null> {
    const selectedReference = this.getProviderReference(selectedExternalMetadataValue);
    if (!selectedReference) {
      this._selectedContent.set(null);
      return this.selectedContent$;
    }

    if (this.directImdbItem?.reference === selectedExternalMetadataValue) {
      this._selectedContent.set(this.directImdbItem.item);
      return of(null, this.directImdbItem.item);
    }

    this.directImdbId = selectedReference?.identitySource === 'imdb' ? selectedReference.identityId : null;

    const itemRequest = this.api.getExternalMetadataItem({
      externalIdentitySource: selectedReference?.identitySource ?? null,
      externalIdentityId: selectedReference?.identityId ?? null,
    });

    itemRequest
      .pipe(
        catchError(() => {
          this._selectedContent.set({} as ExternalMetadataItemModel);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => this._selectedContent.set(response));

    return this.selectedContent$;
  }

  public getProviderReference(selectedExternalMetadataValue: string | null): ExternalMetadataReferenceModel | null {
    return selectedExternalMetadataValue ? (this._matchedReferences()[selectedExternalMetadataValue] ?? null) : null;
  }

  private fetchExternalMetadata(): void {
    if (this.directImdbId) {
      const searchText = this.searchText.trim();
      const searchRequestId = this.searchRequestId;
      const directImdbId = this.directImdbId;
      this.searchSubscription = this.api
        .getExternalMetadataItem({ externalIdentitySource: 'imdb', externalIdentityId: directImdbId })
        .pipe(
          catchError(() => {
            if (searchRequestId === this.searchRequestId) {
              this._matchedContent.set([]);
              this._matchedReferences.set({});
              this._completedSearchText.set(searchText);
            }
            return EMPTY;
          }),
          finalize(() => {
            if (searchRequestId === this.searchRequestId) this._searchPending.set(false);
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          if (searchRequestId !== this.searchRequestId) return;

          const value = this.getExternalMetadataReferenceKey('imdb', directImdbId);
          this.directImdbItem = { reference: value, item: response };
          this._matchedReferences.set({
            [value]: {
              identitySource: 'imdb',
              identityId: directImdbId,
              externalIds: response.externalIds ?? [{ source: 'imdb', id: directImdbId }],
            },
          });
          this._matchedContent.set([
            {
              contentType: response.contentType,
              poster: response.poster,
              text: response.title,
              value,
              year: response.year,
              ...(response.actors ? { actors: response.actors } : {}),
            },
          ]);
          this._completedSearchText.set(searchText);
        });
    } else {
      const searchText = this.searchText.trim();
      const searchRequestId = this.searchRequestId;
      this.searchSubscription = this.api
        .searchExternalMetadata({ s: searchText, provider: this.provider })
        .pipe(
          catchError(() => {
            if (searchRequestId === this.searchRequestId) {
              this._matchedContent.set([]);
              this._matchedReferences.set({});
              this._completedSearchText.set(searchText);
            }
            return EMPTY;
          }),
          finalize(() => {
            if (searchRequestId === this.searchRequestId) this._searchPending.set(false);
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          if (searchRequestId !== this.searchRequestId) return;

          const result: ExternalMetadataSelectDataModel[] = [];
          const references: Record<string, ExternalMetadataReferenceModel> = {};
          if (Array.isArray(response?.results)) {
            for (const responseItem of response.results) {
              const value = this.getExternalMetadataReferenceKey(responseItem.provider, responseItem.providerItemId);
              references[value] = {
                identitySource: responseItem.provider,
                identityId: responseItem.providerItemId,
                externalIds: responseItem.externalIds,
              };
              result.push({
                contentType: responseItem.contentType,
                poster: responseItem.poster,
                text: responseItem.title,
                value,
                year: responseItem.year,
                ...(responseItem.actors ? { actors: responseItem.actors } : {}),
              });
            }
          }

          this._matchedContent.set(result);
          this._matchedReferences.set(references);
          this._completedSearchText.set(searchText);
        });
    }
  }

  private getExternalMetadataReferenceKey(identitySource: string, identityId: string): string {
    return `${encodeURIComponent(identitySource)}/${encodeURIComponent(identityId)}`;
  }
}
