import { Injectable } from '@angular/core';

@Injectable()
export class DisconnectService {
  public disconnect(): void {
    localStorage.clear();
  }
}
