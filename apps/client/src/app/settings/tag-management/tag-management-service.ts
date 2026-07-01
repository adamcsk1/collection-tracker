import { inject, Injectable } from '@angular/core';
import { TagManagementModel } from './tag-management-model';
import { tagManagementStateToken } from '../../tag-management/tag-management-store';
import { ApiService } from '@services/api/api-service';
import { map, Observable, tap } from 'rxjs';
import { RenameTagApiResponseModel } from '@shared/models/api-model';

@Injectable({ providedIn: 'root' })
export class TagManagementService {
  private readonly api = inject(ApiService);
  private readonly tagManagementState = inject(tagManagementStateToken);

  public preloadUserTagManagement(): Observable<void> {
    return this.api.getUserTagManagement().pipe(
      tap((configs) => this.tagManagementState.setState('configs', this.sortTagManagement(configs))),
      map(() => void 0)
    );
  }

  public syncUserTagManagement(configs: TagManagementModel): Observable<void> {
    const sortedConfigs = this.sortTagManagement(configs);
    this.tagManagementState.setState('configs', sortedConfigs);
    return this.api.updateUserTagManagement(sortedConfigs);
  }

  public renameTag(oldTag: string, newTag: string): Observable<RenameTagApiResponseModel> {
    return this.api.renameTag(oldTag, newTag).pipe(
      tap((response) => {
        if (response.renamedItemCount > 0) {
          this.tagManagementState.setState('configs', this.sortTagManagement(response.tagManagement));
        }
      }),
      map((response) => response)
    );
  }

  private sortTagManagement(configs: TagManagementModel): TagManagementModel {
    return [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}
