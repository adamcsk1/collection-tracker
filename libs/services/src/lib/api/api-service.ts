import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertService } from '@services/alert-service';
import { ApiCreateModel, ApiGetAllModel } from '@services/api/api-model';
import { apiStateToken } from '@services/api/api-store';
import { catchError, filter, Observable, of, Subject, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly apiState = inject(apiStateToken);
  private readonly headerBuilder = (temporaryToken?: string) => ({
    headers: { Authorization: `Bearer ${temporaryToken || this.apiState.state.token()}` },
  });

  public getStatus({
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
        `${temporaryApiUrl || this.apiState.state.apiUrl()}/status-guarded`,
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

  public getAll(): Observable<ApiGetAllModel> {
    this.apiState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<ApiGetAllModel>();
    const fetchBatchSize = this.apiState.state.fetchBatchSize() || 10;

    const lazyLoad = (offset = 0) =>
      this.httpClient
        .get<ApiGetAllModel>(
          `${this.apiState.state.apiUrl()}/get-all?offset=${offset}&limit=${fetchBatchSize}`,
          this.headerBuilder()
        )
        .pipe(
          tap((response) => {
            if (response.length > 0) {
              lazyLoad(offset + fetchBatchSize)
                .pipe(
                  catchError((error) => {
                    console.error(error.message);
                    this.apiState.setState('loadNetworkStatus', 'error');
                    throw new Error(error.message);
                  })
                )
                .subscribe((items) => results.next(items));
            } else {
              this.apiState.setState('loadNetworkStatus', 'finished');
            }
          }),
          filter((response) => response.length > 0)
        );

    lazyLoad()
      .pipe(
        catchError((error) => {
          this.apiState.setState('loadNetworkStatus', 'error');
          console.error(error.message);
          throw new Error(error.message);
        })
      )
      .subscribe((items) => results.next(items));

    return results.asObservable();
  }

  public create(content: string): Observable<ApiCreateModel> {
    return this.httpClient
      .post<ApiCreateModel>(
        `${this.apiState.state.apiUrl()}/create`,
        {
          content,
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

  public update(name: string, content: string): Observable<void> {
    return this.httpClient
      .put<void>(
        `${this.apiState.state.apiUrl()}/modify/${name}`,
        {
          content,
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

  public delete(name: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/delete/${name}`, this.headerBuilder()).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }
}
