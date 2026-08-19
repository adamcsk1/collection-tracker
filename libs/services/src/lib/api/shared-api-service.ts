import { HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type {
  HealthDiagnosticsApiResponseModel,
  UserSettingsApiRequestModel,
  UserSettingsApiResponseModel,
} from '@shared/models/api-model';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api-service';
import { redirectOnRefreshFailureContext } from './auth-request-context';

@Injectable({
  providedIn: 'root',
})
export class SharedApiService extends BaseApiService {
  public getHealthDiagnostics(): Observable<HealthDiagnosticsApiResponseModel> {
    return this.request('GET', '/users/me/health', undefined, {
      context: new HttpContext().set(redirectOnRefreshFailureContext, false),
      suppressErrorAlert: true,
    });
  }

  public updateUserSettings(userSettings: UserSettingsApiRequestModel): Observable<UserSettingsApiResponseModel> {
    return this.request('POST', '/users/me/settings', userSettings);
  }
}
