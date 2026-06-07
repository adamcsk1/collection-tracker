import { ChangeDetectionStrategy, Component, OnInit, inject, computed, signal } from '@angular/core';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { SelectDataModel } from '@shared/models/select-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';
import { ExternalRatingsRefreshService } from './external-ratings-refresh/external-ratings-refresh-service';
import { ImageRefreshService } from './image-refresh/image-refresh-service';

@Component({
  selector: 'ct-settings-media-refresh',
  imports: [Select],
  templateUrl: './media-refresh.html',
  styleUrl: './media-refresh.css',
  providers: [ExternalRatingsRefreshService, ImageRefreshService, SharesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsMediaRefresh implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly externalRatingsRefresh = inject(ExternalRatingsRefreshService);
  private readonly imageRefresh = inject(ImageRefreshService);
  private readonly sharesService = inject(SharesService);
  private readonly sharesState = inject(sharesStateToken);
  protected readonly selectedOwnerShareCode = signal('');
  protected readonly externalRatingsRefreshState = this.externalRatingsRefresh.state;
  protected readonly imageRefreshState = this.imageRefresh.state;
  protected readonly translations = {
    checked: computed(() => this.ngxSignalTranslate.translate('Checked')),
    errors: computed(() => this.ngxSignalTranslate.translate('Errors')),
    library: computed(() => this.ngxSignalTranslate.translate('Library')),
    externalRatingsRefresh: computed(() => this.ngxSignalTranslate.translate('ExternalRatingsRefresh')),
    fixed: computed(() => this.ngxSignalTranslate.translate('Fixed')),
    imageRefresh: computed(() => this.ngxSignalTranslate.translate('ImageRefresh')),
    messageMissingImages: computed(() => this.ngxSignalTranslate.translate('Message.MissingImages')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
    count: computed(() => this.ngxSignalTranslate.translate('Count')),
    updated: computed(() => this.ngxSignalTranslate.translate('Updated')),
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

  protected onStartExternalRatingsRefresh(): void {
    this.externalRatingsRefresh.refreshExternalRatings(this.selectedOwnerShareCode() || undefined);
  }

  protected onLibraryChange(selectedValue: SelectDataModel['value']): void {
    this.selectedOwnerShareCode.set(typeof selectedValue === 'string' ? selectedValue : '');
  }
}
