import { ChangeDetectionStrategy, Component, OnInit, inject, computed, signal } from '@angular/core';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { SelectDataModel } from '@shared/models/select-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';
import { ImageRefreshService } from './image-refresh/image-refresh-service';

@Component({
  selector: 'ct-settings-images',
  imports: [Select],
  templateUrl: './images.html',
  styleUrl: './images.css',
  providers: [ImageRefreshService, SharesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsImages implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly sharesService = inject(SharesService);
  private readonly sharesState = inject(sharesStateToken);
  protected readonly selectedOwnerShareCode = signal('');
  protected readonly translations = {
    library: computed(() => this.ngxSignalTranslate.translate('Library')),
    messageMissingImages: computed(() => this.ngxSignalTranslate.translate('Message.MissingImages')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
    start: computed(() => this.ngxSignalTranslate.translate('Start')),
  };
  protected readonly apiLoadNetworkStatus = inject(apiStateToken).state.loadNetworkStatus;
  protected readonly libraryOptions = computed(() => [
    { text: this.translations.myLibrary(), value: '' },
    ...this.sharesState.state
      .incoming()
      .filter((share) => share.canUpdate)
      .map((share) => ({
        text: `${this.translations.sharedLibrary()} (${share.ownerUsername ?? share.ownerUserShareCode})`,
        value: share.ownerUserShareCode,
      })),
  ]);
  protected readonly showLibrarySelect = computed(() => this.libraryOptions().length > 1);

  public ngOnInit(): void {
    this.sharesService.loadShares();
  }

  protected onStartImagesRefresh(): void {
    this.imageRefresh.refreshImages(this.selectedOwnerShareCode() || undefined);
  }

  protected onLibraryChange(selectedValue: SelectDataModel['value']): void {
    this.selectedOwnerShareCode.set(typeof selectedValue === 'string' ? selectedValue : '');
  }
}
