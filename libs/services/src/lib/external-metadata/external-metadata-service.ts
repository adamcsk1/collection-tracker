import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ExternalMetadataItemModel,
  ExternalMetadataReferenceModel,
  ExternalMetadataSelectDataModel,
} from '@shared/models/external-metadata-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { getIMDbId } from '@shared/utils/imdb-id-util';
import { catchError, EMPTY, Observable } from 'rxjs';
import { AlertService } from '../alert-service';
import { ApiService } from '../api/api-service';

@Injectable()
export class ExternalMetadataService {
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private searchText = '';
  private directImdbId: string | null = null;
  private searchRequestId = 0;
  private provider: ExternalMetadataProviderNameModel | null = null;
  private readonly _matchedContent = signal<ExternalMetadataSelectDataModel[]>([]);
  private readonly _matchedReferences = signal<Record<string, ExternalMetadataReferenceModel>>({});
  private readonly _selectedContent = signal<ExternalMetadataItemModel | null>(null);
  private readonly _completedSearchText = signal('');
  public readonly matchedContent = this._matchedContent.asReadonly();
  public readonly selectedContent = this._selectedContent.asReadonly();
  public readonly completedSearchText = this._completedSearchText.asReadonly();
  public readonly selectedContent$ = toObservable(this.selectedContent);

  public getMatchedContents(searchText: string, provider: ExternalMetadataProviderNameModel | null = null): void {
    this.searchText = searchText;
    this.provider = provider;
    this.directImdbId = provider === 'openlibrary' ? null : getIMDbId(this.searchText) || null;
    this.searchRequestId++;
    this._completedSearchText.set('');

    this.fetchExternalMetadata();
  }

  public getSelectedContent(selectedExternalMetadataValue: string): Observable<ExternalMetadataItemModel | null> {
    const selectedReference = this.getProviderReference(selectedExternalMetadataValue);
    if (!selectedReference) {
      this._selectedContent.set(null);
      return this.selectedContent$;
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
      const value = this.getExternalMetadataReferenceKey('imdb', this.directImdbId);
      this._matchedReferences.set({
        [value]: {
          identitySource: 'imdb',
          identityId: this.directImdbId,
          externalIds: [{ source: 'imdb', id: this.directImdbId }],
        },
      });
      this._matchedContent.set([
        {
          text: `IMDb id: ${this.directImdbId}`,
          value,
        },
      ]);
    } else {
      const searchText = this.searchText.trim();
      const searchRequestId = this.searchRequestId;
      this.api
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
