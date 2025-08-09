import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { spinnerLoadingStateToken } from '@lib/components/spinner-loading/spinner-loading-store';
import { AlertService } from '@lib/services/alert-service';
import { ApiResponseModel, MemoModel, MemosModel } from '@lib/services/memos/memos-model';
import { memosStateToken } from '@lib/services/memos/memos-store';
import dayjs from 'dayjs';
import { catchError, filter, map, Observable, of, Subject, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MemosService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly memosState = inject(memosStateToken);
  private readonly spinnerLoadingState = inject(spinnerLoadingStateToken);
  private readonly headerBuilder = (temporaryToken?: string) => ({
    headers: { Authorization: `Bearer ${temporaryToken || this.memosState.state.token()}` },
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
        `${temporaryApiUrl || this.memosState.state.apiUrl()}/workspace/profile`,
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
    this.spinnerLoadingState.setState('show', true);
    this.memosState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<MemosModel>();

    const paginatedLoadItems = (pageToken?: string) =>
      this.httpClient
        .get<ApiResponseModel>(
          // ? The crate_time in descending order does not actually sort by createTime.
          // ? Ref: https://github.com/usememos/memos/blob/f4bdfa28a00514e71644980bd6dcf588da9798cb/server/router/api/v1/memo_service.go#L753
          `${this.memosState.state.apiUrl()}/memos?orderBy=create_time%20desc&pageSize=${this.memosState.state.fetchBatchSize()}&state=NORMAL&filter=${encodeURIComponent(`content.contains("#series") || content.contains("#movie")`)}${pageToken ? `&pageToken=${pageToken}` : ''}`,
          this.headerBuilder()
        )
        .pipe(
          tap((response) => {
            if (response.nextPageToken) {
              paginatedLoadItems(encodeURIComponent(response.nextPageToken))
                .pipe(
                  catchError((error) => {
                    console.error(error.message);
                    this.memosState.setState('loadNetworkStatus', 'error');
                    throw new Error(error.message);
                  })
                )
                .subscribe((items) => results.next(items));
            } else {
              this.memosState.setState('loadNetworkStatus', 'finished');
              this.spinnerLoadingState.setState('show', false);
            }
          }),
          map((response) => response.memos),
          filter((mdContent) => !!mdContent)
        );

    paginatedLoadItems()
      .pipe(
        catchError((error) => {
          this.spinnerLoadingState.setState('show', false);
          this.memosState.setState('loadNetworkStatus', 'error');
          console.error(error.message);
          throw new Error(error.message);
        })
      )
      .subscribe((items) => results.next(items));

    return results.asObservable();
  }

  public createMemo(content: string): Observable<MemoModel> {
    return this.httpClient
      .post<MemoModel>(
        `${this.memosState.state.apiUrl()}/memos`,
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
        `${this.memosState.state.apiUrl()}/memos/${name.replace('memos/', '')}`,
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
      .delete<void>(`${this.memosState.state.apiUrl()}/memos/${name.replace('memos/', '')}`, this.headerBuilder())
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }
}
