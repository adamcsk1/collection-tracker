import { Injectable } from '@angular/core';
import type { HealthApiResponseModel, SignUpApiResponseModel } from '@shared/models/api-model';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class PublicApiService extends BaseApiService {
  public getHealth(): Observable<HealthApiResponseModel> {
    return this.request('GET', '/health');
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
