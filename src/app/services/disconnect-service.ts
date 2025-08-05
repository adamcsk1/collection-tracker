import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DisconnectService {
  public disconnect(): void {
    localStorage.clear();
  }
}
