import { inject, Injectable } from '@angular/core';
import { TagConfigsModel } from '@client/tag-configs/tag-configs-model';
import { tagConfigsStateToken } from '@client/tag-configs/tag-configs-store';
import { ApiService } from '@services/api/api-service';
import { map, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TagConfigsService {
  private readonly api = inject(ApiService);
  private readonly tagConfigsState = inject(tagConfigsStateToken);

  public preloadUserTagConfigs(): Observable<void> {
    return this.api.getUserTagConfigs().pipe(
      tap((configs) => this.tagConfigsState.setState('configs', this.sortTagConfigs(configs))),
      map(() => void 0),
    );
  }

  public syncUserTagConfigs(configs: TagConfigsModel): Observable<void> {
    const sortedConfigs = this.sortTagConfigs(configs);
    this.tagConfigsState.setState('configs', sortedConfigs);
    return this.api.updateUserTagConfigs(sortedConfigs);
  }

  private sortTagConfigs(configs: TagConfigsModel): TagConfigsModel {
    return [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}
