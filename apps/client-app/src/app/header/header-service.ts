import { Injectable } from '@angular/core';

@Injectable()
export class HeaderService {
  public disconnect(): void {
    localStorage.clear();
  }
}
