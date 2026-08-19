import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type {
  ApiProblemModel,
  ApiResponseModel,
  CursorPageModel,
  PaginatedApiResponseModel,
} from '@shared/models/api-envelope-model';
import { catchError, map, Observable, throwError } from 'rxjs';
import { AlertService } from '../alert-service';
import type { ApiRequestOptions } from './api-request-model';
import { apiStateToken } from './api-store';

export abstract class BaseApiService {
  private readonly alert = inject(AlertService);
  protected readonly httpClient = inject(HttpClient);
  protected readonly apiState = inject(apiStateToken);
  protected get apiUrl(): string {
    return this.apiState.state.apiUrl();
  }

  protected request<T>(method: string, path: string, body?: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.httpClient
      .request<ApiResponseModel<T> | null>(method, `${this.apiUrl}${path}`, {
        ...(body !== undefined ? { body } : {}),
        context: options.context,
      })
      .pipe(
        map((response): T => (response === null ? (null as T) : response.data)),
        catchError((error: HttpErrorResponse) => {
          const problem = error.error as Partial<ApiProblemModel> | null;
          const detail = problem && typeof problem === 'object' && typeof problem.detail === 'string' && problem.detail;
          if (!options.suppressErrorAlert) this.alert.show(detail || error.message);
          return throwError(() => error);
        })
      );
  }

  protected paginatedRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {}
  ): Observable<{ items: T[]; page: CursorPageModel }> {
    return this.httpClient
      .request<PaginatedApiResponseModel<T>>(method, `${this.apiUrl}${path}`, {
        ...(body !== undefined ? { body } : {}),
        context: options.context,
      })
      .pipe(
        map(({ data, page }) => ({ items: data, page })),
        catchError((error: HttpErrorResponse) => {
          const problem = error.error as Partial<ApiProblemModel> | null;
          const detail = problem && typeof problem === 'object' && typeof problem.detail === 'string' && problem.detail;
          if (!options.suppressErrorAlert) this.alert.show(detail || error.message);
          return throwError(() => error);
        })
      );
  }
}
