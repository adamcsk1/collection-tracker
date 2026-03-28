import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertService } from '@services/alert-service';
import { apiStateToken } from '@services/api/api-store';
import {
  type HealthApiResponseModel,
  SignInApiRequestModel,
  SignUpApiRequestModel,
  SignUpApiResponseModel,
} from '@shared/models/api-model';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PublicApiService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly apiState = inject(apiStateToken);

  public getHealth(): Observable<HealthApiResponseModel> {
    return this.httpClient.get<HealthApiResponseModel>(`${this.apiState.state.apiUrl()}/health`).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      }),
    );
  }

  public signUp(username: string): Observable<SignUpApiResponseModel> {
    const body: SignUpApiRequestModel = { username };
    return this.httpClient.post<SignUpApiResponseModel>(`${this.apiState.state.apiUrl()}/sign-up`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      }),
    );
  }

  public validateAccessToken(): Observable<void> {
    return this.httpClient.get<void>(`${this.apiState.state.apiUrl()}/user/access-token/validate`);
  }

  public signIn(username: string, token: string): Observable<void> {
    const body: SignInApiRequestModel = { username, token };
    return this.httpClient.post<void>(`${this.apiState.state.apiUrl()}/sign-in`, body).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      }),
    );
  }
}
