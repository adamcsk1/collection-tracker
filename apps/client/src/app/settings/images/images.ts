import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { ImageRefreshService } from './image-refresh/image-refresh-service';

@Component({
  selector: 'ct-settings-images',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './images.html',
  styleUrl: './images.css',
  providers: [ImageRefreshService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsImages {
  private readonly imageRefresh = inject(ImageRefreshService);
  protected readonly apiLoadNetworkStatus = inject(apiStateToken).state.loadNetworkStatus;

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }
}
