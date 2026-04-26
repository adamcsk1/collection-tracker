import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { AlertService } from '../alert-service';
import { apiStateToken } from './api-store';

export abstract class BaseApiService {
  private readonly alert = inject(AlertService);
  protected readonly httpClient = inject(HttpClient);
  protected readonly apiState = inject(apiStateToken);
  protected get apiUrl(): string {
    return this.apiState.state.apiUrl();
  }

  protected request<T>(method: string, path: string, body?: unknown): Observable<T> {
    return this.httpClient.request<T>(method, `${this.apiUrl}${path}`, body !== undefined ? { body } : {}).pipe(
      catchError((error) => {
        this.alert.show(error.message);
        return throwError(() => error);
      })
    );
  }
}
