import { Injectable } from '@angular/core';
import type {
  BackgroundImagesApiResponseModel,
  HealthApiResponseModel,
  SignUpApiResponseModel,
} from '@shared/models/api-model';
import { Observable } from 'rxjs';
import type { ApiRequestOptions } from './api-request-model';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class PublicApiService extends BaseApiService {
  public getHealth(options: ApiRequestOptions = {}): Observable<HealthApiResponseModel> {
    return this.request('GET', '/health', undefined, options);
  }

  public getBackgroundImages(): Observable<BackgroundImagesApiResponseModel> {
    return this.request('GET', '/images/background', undefined, { suppressErrorAlert: true });
  }

  public signUp(username: string): Observable<SignUpApiResponseModel> {
    return this.request('POST', '/auth/sign-up', { username });
  }

  public validateSession(): Observable<void> {
    // Validates the session by attempting a refresh. On success the server sets a new access-token cookie.
    // No error handling wrapper - callers handle 401/403 themselves.
    return this.httpClient.post<void>(`${this.apiUrl}/auth/session/refresh`, {});
  }

  public signIn(username: string, token: string): Observable<void> {
    return this.request('POST', '/auth/sign-in', { username, token });
  }
}
