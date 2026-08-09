import { Injectable } from '@angular/core';
import type { UserSettingsApiRequestModel, UserSettingsApiResponseModel } from '@shared/models/api-model';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class SharedApiService extends BaseApiService {
  public updateUserSettings(userSettings: UserSettingsApiRequestModel): Observable<UserSettingsApiResponseModel> {
    return this.request('POST', '/users/me/settings', userSettings);
  }
}
