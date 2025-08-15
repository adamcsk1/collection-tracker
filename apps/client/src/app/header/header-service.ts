import { inject, Injectable } from '@angular/core';
import { WebstorageService } from '@services/webstorage/webstorage-service';

@Injectable()
export class HeaderService {
  private readonly webstorage = inject(WebstorageService);

  public disconnect(): void {
    this.webstorage.clear();
  }
}
