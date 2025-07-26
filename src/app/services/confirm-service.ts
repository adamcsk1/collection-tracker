import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  // ?? Temporary native alert
  public open(message: string): Observable<boolean> {
    return of(confirm(message));
  }
}
