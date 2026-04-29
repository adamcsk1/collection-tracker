import { inject, Injectable } from '@angular/core';
import { catchError, Observable, Subject, take, tap, throwError } from 'rxjs';
import { PublicApiService } from './public-api-service';

@Injectable({ providedIn: 'root' })
export class RefreshTokenService {
  private readonly publicApi = inject(PublicApiService);
  private isRefreshing = false;
  private refreshSubject = new Subject<void>();

  public refresh(): Observable<void> {
    if (this.isRefreshing) {
      return this.refreshSubject.asObservable().pipe(take(1));
    }
    this.isRefreshing = true;
    return this.publicApi.validateSession().pipe(
      tap(() => {
        this.isRefreshing = false;
        this.refreshSubject.next();
        this.refreshSubject.complete();
        this.refreshSubject = new Subject<void>();
      }),
      catchError((error) => {
        this.isRefreshing = false;
        this.refreshSubject.error(error);
        this.refreshSubject = new Subject<void>();
        return throwError(() => error);
      })
    );
  }
}
