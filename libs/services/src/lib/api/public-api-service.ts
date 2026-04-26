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
    return this.request('POST', '/sign-up', { username });
  }

  public validateAccessToken(): Observable<void> {
    // No error handling wrapper — callers handle 401 themselves.
    return this.httpClient.get<void>(`${this.apiUrl}/user/access-token/validate`);
  }

  public signIn(username: string, token: string): Observable<void> {
    return this.request('POST', '/sign-in', { username, token });
  }
}
