import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertService } from '../alert-service';
import { apiStateToken } from './api-store';
import { UserSettingsApiRequestModel } from '@shared/models/api-model';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SharedApiService {
  private readonly alert = inject(AlertService);
  private readonly httpClient = inject(HttpClient);
  private readonly apiState = inject(apiStateToken);

  public updateUserSettings(userSettings: UserSettingsApiRequestModel): Observable<void> {
    return this.httpClient.post<void>(`${this.apiState.state.apiUrl()}/user/settings`, userSettings).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }
}
