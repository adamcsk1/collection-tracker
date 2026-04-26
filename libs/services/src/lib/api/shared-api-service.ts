import { Injectable } from '@angular/core';
import type { UserSettingsApiRequestModel } from '@shared/models/api-model';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api-service';

@Injectable({
  providedIn: 'root',
})
export class SharedApiService extends BaseApiService {
  public updateUserSettings(userSettings: UserSettingsApiRequestModel): Observable<void> {
    return this.request('POST', '/user/settings', userSettings);
  }
}
