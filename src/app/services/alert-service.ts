import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  // ?? Temporary native alert
  public show(message: string): void {
    alert(message);
  }
}
