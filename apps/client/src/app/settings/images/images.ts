import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { ImageRefreshService } from './image-refresh/image-refresh-service';

@Component({
  selector: 'ct-settings-images',
  templateUrl: './images.html',
  styleUrl: './images.css',
  providers: [ImageRefreshService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsImages {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly imageRefresh = inject(ImageRefreshService);
  protected readonly translations = {
    messageMissingImages: computed(() => this.ngxSignalTranslate.translate('Message.MissingImages')),
    start: computed(() => this.ngxSignalTranslate.translate('Start')),
  };
  protected readonly apiLoadNetworkStatus = inject(apiStateToken).state.loadNetworkStatus;

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages();
  }
}
