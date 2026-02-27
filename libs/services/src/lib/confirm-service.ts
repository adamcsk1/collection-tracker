import { Injectable } from '@angular/core';
import { filter, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  // ?? Temporary native alert
  public open(message: string): Observable<boolean> {
    return of(confirm(message));
  }

  public ifConfirmed(message: string): Observable<boolean> {
    return this.open(message).pipe(filter((confirmed) => confirmed));
  }
}
