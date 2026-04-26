import { Injectable } from '@angular/core';
import {
  AccessTokensApiResponseModel,
  ChangeApiResponseModel,
  ChangeTokenApiResponseModel,
  CreateAccessTokenApiResponseModel,
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
import { catchError, EMPTY, filter, Observable, Subject, tap } from 'rxjs';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class ApiService extends BaseApiService {
  public logout(): Observable<void> {
    return this.request('DELETE', '/logout');
  }

  public getAll(): Observable<GetAllApiResponseModel> {
    this.apiState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<GetAllApiResponseModel>();
    const fetchBatchSize = this.apiState.state.fetchBatchSize() || 100;

    const lazyLoad = (offset = 0) =>
      this.httpClient
        .get<GetAllApiResponseModel>(`${this.apiUrl}/get-all?offset=${offset}&limit=${fetchBatchSize}`)
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
    return this.request('POST', '/create', { content, name });
  }

  public update(name: string, content: string, hash: string): Observable<ChangeApiResponseModel> {
    return this.request('PUT', `/change/${name}`, { content, hash });
  }

  public delete(name: string, hash: string): Observable<void> {
    return this.request('DELETE', `/delete/${name}?hash=${hash}`);
  }

  public getAccessTokens(): Observable<AccessTokensApiResponseModel> {
    return this.request('GET', '/user/access-tokens');
  }

  public deleteAccessToken(tokenHash: string): Observable<void> {
    return this.request('DELETE', `/user/access-token/${tokenHash}`);
  }

  public createAccessToken(): Observable<CreateAccessTokenApiResponseModel> {
    return this.request('POST', '/user/access-token', {});
  }

  public createNewUserToken(): Observable<ChangeTokenApiResponseModel> {
    return this.request('PUT', '/user/change-token', {});
  }

  public deleteUser(): Observable<void> {
    return this.request('DELETE', '/user');
  }

  public getUserParserConfig(): Observable<ParserConfigApiResponseModel | null> {
    return this.request('GET', '/parser/config');
  }

  public updateUserParserConfig(parserConfig: ParserConfigApiRequestModel): Observable<void> {
    return this.request('POST', '/parser/change-config', parserConfig);
  }

  public getUserSettings(): Observable<UserSettingsApiResponseModel> {
    return this.request('GET', '/user/settings');
  }

  public getUserTagConfigs(): Observable<TagConfigsApiResponseModel> {
    return this.request('GET', '/tag/config');
  }

  public updateUserTagConfigs(tagConfigs: TagConfigsApiRequestModel): Observable<void> {
    return this.request('POST', '/tag/change-config', tagConfigs);
  }

  public getOMDbData(queryParams: { i: string | null }): Observable<OMDbResponseItemModel> {
    return this.request('GET', `/proxy/omdb/item?i=${queryParams.i}`);
  }

  public getOMDbSearchData(queryParams: { s: string | null }): Observable<OMDbResponseModel> {
    return this.request('GET', `/proxy/omdb/search?s=${queryParams.s}`);
  }

  public getClaudeQueryData(prompt: string): Observable<ClaudeQueryResponseModel> {
    const body: ClaudeQueryRequestModel = { prompt };
    return this.request('POST', '/proxy/claude/query', { prompt: body.prompt });
  }
}
