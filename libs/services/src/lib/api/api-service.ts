import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertService } from '@services/alert-service';
import { apiStateToken } from '@services/api/api-store';
import {
  AccessTokensApiResponseModel,
  ChangeTokenApiResponseModel,
  CreateAccessTokenApiResponseModel,
  CreateApiRequestModel,
  CreateApiResponseModel,
  GetAllApiResponseModel,
  ModifyApiRequestModel,
  SignInApiRequestModel,
  SignUpApiRequestModel,
  SignUpApiResponseModel,
} from '@shared/models/api-model';
import { catchError, filter, Observable, of, Subject, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly apiState = inject(apiStateToken);

  public getHealth({
    temporaryApiUrl,
    suppressErrors,
  }: {
    temporaryApiUrl?: string;
    suppressErrors?: boolean;
  }): Observable<void> {
    return this.httpClient.get<void>(`${temporaryApiUrl || this.apiState.state.apiUrl()}/health`).pipe(
      catchError((error) => {
        if (!suppressErrors) {
          this.alert.show(error.message);
          throw new Error(error.message);
        } else return of();
      })
    );
  }

  public signUp(username: string): Observable<SignUpApiResponseModel> {
    const body: SignUpApiRequestModel = { username };
    return this.httpClient.post<SignUpApiResponseModel>(`${this.apiState.state.apiUrl()}/sign-up`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public signIn(username: string, token: string): Observable<void> {
    const body: SignInApiRequestModel = { username, token };
    return this.httpClient.post<void>(`${this.apiState.state.apiUrl()}/sign-in`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public logout(): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/logout`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public validateAccessToken(): Observable<void> {
    return this.httpClient.get<void>(`${this.apiState.state.apiUrl()}/user/access-token/validate`);
  }

  public getAll(): Observable<GetAllApiResponseModel> {
    this.apiState.setState('loadNetworkStatus', 'pending');
    const results = new Subject<GetAllApiResponseModel>();
    const fetchBatchSize = this.apiState.state.fetchBatchSize() || 10;

    const lazyLoad = (offset = 0) =>
      this.httpClient
        .get<GetAllApiResponseModel>(`${this.apiState.state.apiUrl()}/get-all?offset=${offset}&limit=${fetchBatchSize}`)
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

  public create(content: string): Observable<CreateApiResponseModel> {
    const body: CreateApiRequestModel = { content };
    return this.httpClient.post<CreateApiResponseModel>(`${this.apiState.state.apiUrl()}/create`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public update(name: string, content: string): Observable<void> {
    const body: ModifyApiRequestModel = { content };
    return this.httpClient.put<void>(`${this.apiState.state.apiUrl()}/modify/${name}`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public delete(name: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/delete/${name}`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public getAccessTokens(): Observable<AccessTokensApiResponseModel> {
    return this.httpClient.get<AccessTokensApiResponseModel>(`${this.apiState.state.apiUrl()}/user/access-tokens`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public deleteAccessToken(tokenHash: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/user/access-token/${tokenHash}`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }

  public createAccessToken(): Observable<CreateAccessTokenApiResponseModel> {
    return this.httpClient
      .post<CreateAccessTokenApiResponseModel>(`${this.apiState.state.apiUrl()}/user/access-token`, {})
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }

  public createNewUserToken(): Observable<ChangeTokenApiResponseModel> {
    return this.httpClient
      .put<ChangeTokenApiResponseModel>(`${this.apiState.state.apiUrl()}/user/change-token`, {})
      .pipe(
        catchError((error) => {
          this.alert.show(error.message);
          throw new Error(error.message);
        })
      );
  }

  public deleteUser(): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiState.state.apiUrl()}/user`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        throw new Error(error.message);
      })
    );
  }
}
