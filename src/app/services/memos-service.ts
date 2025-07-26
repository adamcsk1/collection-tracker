import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { appStateToken } from '@stores/app-store';
import { collectionStateToken } from '@stores/collection-store';
import dayjs from 'dayjs';
import { catchError, filter, map, Observable, of, Subject, tap } from 'rxjs';
import { AlertService } from './alert-service';
import { ApiResponseModel, MemosModel } from './memos.model';

@Injectable({
  providedIn: 'root',
})
export class MemosService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly appState = inject(appStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly headerBuilder = (temporaryToken?: string) => ({
    headers: { Authorization: `Bearer ${temporaryToken || this.appState.state.memosToken()}` },
  });

  public getProfile({
    temporaryApiUrl,
    temporaryToken,
    suppressErrors,
  }: {
    temporaryApiUrl?: string;
    temporaryToken?: string;
    suppressErrors?: boolean;
  }): Observable<void> {
    return this.httpClient
      .get<void>(
        `${temporaryApiUrl || this.appState.state.memosApiUrl()}/workspace/profile`,
        this.headerBuilder(temporaryToken)
      )
      .pipe(
        catchError((error) => {
          if (!suppressErrors) {
            this.alert.show(error.message);
            throw new Error(error.message);
          } else return of();
        })
      );
  }

  public getMemos(): Observable<MemosModel> {
    this.appState.setState('spinnerLoading', true);
    this.collectionState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<MemosModel>();

    const paginatedLoadItems = (pageToken?: string) =>
      this.httpClient
        .get<ApiResponseModel>(
          `${this.appState.state.memosApiUrl()}/memos?sort=create_time&direction=DESC&pageSize=10000&state=NORMAL&filter=${encodeURIComponent(`content.contains("#series") || content.contains("#movie")`)}${pageToken ? `&pageToken=${pageToken}` : ''}`,
          this.headerBuilder()
        )
        .pipe(
          tap((response) => {
            if (response.nextPageToken) {
              paginatedLoadItems(encodeURIComponent(response.nextPageToken))
                .pipe(
                  catchError((error) => {
                    console.error(error.message);
                    this.collectionState.setState('loadNetworkStatus', 'error');
                    throw new Error(error.message);
                  })
                )
                .subscribe((items) => results.next(items));
            } else {
              this.collectionState.setState('loadNetworkStatus', 'finished');
              this.appState.setState('spinnerLoading', false);
            }
          }),
          map((response) => response.memos),
          filter((mdContent) => !!mdContent)
        );

    paginatedLoadItems()
      .pipe(
        catchError((error) => {
          this.appState.setState('spinnerLoading', false);
          this.collectionState.setState('loadNetworkStatus', 'error');
          console.error(error.message);
          throw new Error(error.message);
        })
      )
      .subscribe((items) => results.next(items));

    return results.asObservable();
  }

  public createMemo(content: string): Observable<void> {
    return this.httpClient
      .post<void>(
        `${this.appState.state.memosApiUrl()}/memos`,
        {
          state: 'NORMAL',
          creator: 'Collection tracker companion for memos',
          createTime: dayjs().toISOString(),
          updateTime: dayjs().toISOString(),
          displayTime: dayjs().toISOString(),
          content,
          visibility: 'PRIVATE',
          pinned: false,
        },
        this.headerBuilder()
      )
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }

  public updateMemo(name: string, content: string): Observable<void> {
    return this.httpClient
      .patch<void>(
        `${this.appState.state.memosApiUrl()}/memos/${name.replace('memos/', '')}`,
        {
          state: 'NORMAL',
          updateTime: dayjs().toISOString(),
          content,
          visibility: 'PRIVATE',
        },
        this.headerBuilder()
      )
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }

  public deleteMemo(name: string): Observable<void> {
    return this.httpClient
      .delete<void>(`${this.appState.state.memosApiUrl()}/memos/${name.replace('memos/', '')}`, this.headerBuilder())
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }
}
