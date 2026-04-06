import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertService } from '@services/alert-service';
import { apiStateToken } from '@services/api/api-store';
import {
  AccessTokensApiResponseModel,
  ChangeApiRequestModel,
  ChangeApiResponseModel,
  ChangeTokenApiResponseModel,
  CreateAccessTokenApiResponseModel,
  CreateApiRequestModel,
  CreateApiResponseModel,
  GetAllApiResponseModel,
  ParserConfigApiRequestModel,
  ParserConfigApiResponseModel,
  TagConfigsApiRequestModel,
  TagConfigsApiResponseModel,
  UserSettingsApiResponseModel,
} from '@shared/models/api-model';
import { ClaudeQueryRequestModel, ClaudeQueryResponseModel } from '@shared/models/claude-model';
import { OMDbResponseItemModel, OMDbResponseModel } from '@shared/models/omdb-model';
import { catchError, EMPTY, filter, Observable, Subject, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly apiState = inject(apiStateToken);

  public logout(): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/logout`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getAll(): Observable<GetAllApiResponseModel> {
    this.apiState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<GetAllApiResponseModel>();
    const fetchBatchSize = this.apiState.state.fetchBatchSize() || 100;

    const lazyLoad = (offset = 0) =>
      this.httpClient
        .get<GetAllApiResponseModel>(`${this.apiState.state.apiUrl()}/get-all?offset=${offset}&limit=${fetchBatchSize}`)
        .pipe(
          tap((response) => {
            if (response.length > 0) {
              lazyLoad(offset + fetchBatchSize)
                .pipe(
                  catchError(() => {
                    this.apiState.setState('loadNetworkStatus', 'error');
                    return EMPTY;
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
        catchError(() => {
          this.apiState.setState('loadNetworkStatus', 'error');
          return EMPTY;
        })
      )
      .subscribe((items) => results.next(items));

    return results.asObservable();
  }

  public create(content: string, name: string): Observable<CreateApiResponseModel> {
    const body: CreateApiRequestModel = { content, name };
    return this.httpClient.post<CreateApiResponseModel>(`${this.apiState.state.apiUrl()}/create`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public update(name: string, content: string, hash: string): Observable<ChangeApiResponseModel> {
    const body: ChangeApiRequestModel = { content, hash };
    return this.httpClient.put<ChangeApiResponseModel>(`${this.apiState.state.apiUrl()}/change/${name}`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public delete(name: string, hash: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/delete/${name}?hash=${hash}`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getAccessTokens(): Observable<AccessTokensApiResponseModel> {
    return this.httpClient.get<AccessTokensApiResponseModel>(`${this.apiState.state.apiUrl()}/user/access-tokens`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public deleteAccessToken(tokenHash: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/user/access-token/${tokenHash}`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public createAccessToken(): Observable<CreateAccessTokenApiResponseModel> {
    return this.httpClient
      .post<CreateAccessTokenApiResponseModel>(`${this.apiState.state.apiUrl()}/user/access-token`, {})
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }

  public createNewUserToken(): Observable<ChangeTokenApiResponseModel> {
    return this.httpClient
      .put<ChangeTokenApiResponseModel>(`${this.apiState.state.apiUrl()}/user/change-token`, {})
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }

  public deleteUser(): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/user`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getUserParserConfig(): Observable<ParserConfigApiResponseModel | null> {
    return this.httpClient
      .get<ParserConfigApiResponseModel | null>(`${this.apiState.state.apiUrl()}/parser/config`)
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }

  public updateUserParserConfig(parserConfig: ParserConfigApiRequestModel): Observable<void> {
    return this.httpClient.post<void>(`${this.apiState.state.apiUrl()}/parser/change-config`, parserConfig).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getUserSettings(): Observable<UserSettingsApiResponseModel> {
    return this.httpClient.get<UserSettingsApiResponseModel>(`${this.apiState.state.apiUrl()}/user/settings`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getUserTagConfigs(): Observable<TagConfigsApiResponseModel> {
    return this.httpClient.get<TagConfigsApiResponseModel>(`${this.apiState.state.apiUrl()}/tag/config`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public updateUserTagConfigs(tagConfigs: TagConfigsApiRequestModel): Observable<void> {
    return this.httpClient.post<void>(`${this.apiState.state.apiUrl()}/tag/change-config`, tagConfigs).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }

  public getOMDbData(queryParams: { i: string | null }): Observable<OMDbResponseItemModel> {
    return this.httpClient
      .get<OMDbResponseItemModel>(`${this.apiState.state.apiUrl()}/proxy/omdb/item?i=${queryParams.i}`)
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }

  public getOMDbSearchData(queryParams: { s: string | null }): Observable<OMDbResponseModel> {
    return this.httpClient
      .get<OMDbResponseModel>(`${this.apiState.state.apiUrl()}/proxy/omdb/search?s=${queryParams.s}`)
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }

  public getClaudeQueryData(prompt: string): Observable<ClaudeQueryResponseModel> {
    const body: ClaudeQueryRequestModel = { prompt };
    return this.httpClient
      .post<ClaudeQueryResponseModel>(`${this.apiState.state.apiUrl()}/proxy/claude/query`, body)
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          return throwError(() => error);
        })
      );
  }
}
