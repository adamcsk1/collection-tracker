import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Select } from '@components/select/select';
import { apiStateToken } from '@services/api/api-store';
import { SelectDataModel } from '@shared/models/select-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';
import { ManageTrackerDataService } from './manage-tracker-data-service';
import { mainStateToken } from '../../main/main-store';

@Component({
  selector: 'ct-settings-manage-tracker-data',
  imports: [Select],
  templateUrl: './manage-tracker-data.html',
  styleUrl: './manage-tracker-data.css',
  providers: [ManageTrackerDataService, SharesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsManageTrackerData implements OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly manageTrackerData = inject(ManageTrackerDataService);
  private readonly sharesService = inject(SharesService);
  private readonly sharesState = inject(sharesStateToken);

  protected readonly selectedOwnerShareCode = signal('');
  protected readonly apiLoadNetworkStatus = inject(apiStateToken).state.loadNetworkStatus;
  protected readonly featurePreferences = inject(mainStateToken).state.collectionFeaturePreferences;
  protected readonly translations = {
    library: computed(() => this.ngxSignalTranslate.translate('Library')),
    messageManageTrackerData: computed(() => this.ngxSignalTranslate.translate('Message.ManageTrackerData')),
    markAllMoviesAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllMoviesAsWatched')),
    markAllMoviesAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAllMoviesAsUnwatched')),
    markAllSeriesAsWatched: computed(() => this.ngxSignalTranslate.translate('MarkAllSeriesAsWatched')),
    markAllSeriesAsUnwatched: computed(() => this.ngxSignalTranslate.translate('MarkAllSeriesAsUnwatched')),
    messageTrackerCleanup: computed(() => this.ngxSignalTranslate.translate('Message.TrackerCleanup')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    removeAllTrackedMovieData: computed(() => this.ngxSignalTranslate.translate('RemoveAllTrackedMovieData')),
    removeAllTrackedSeriesData: computed(() => this.ngxSignalTranslate.translate('RemoveAllTrackedSeriesData')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
  };
  protected readonly libraryOptions = computed(() => [
    { text: this.translations.myLibrary(), value: '' },
    ...this.sharesState.state
      .incoming()
      .filter((share) => share.canRead)
      .map((share) => ({
        text: `${this.translations.sharedLibrary()} (${share.ownerUsername ?? share.ownerUserShareCode})`,
        value: share.ownerUserShareCode,
      })),
  ]);
  protected readonly showLibrarySelect = computed(() => this.libraryOptions().length > 1);

  public ngOnInit(): void {
    this.sharesService.loadShares();
  }

  protected onMarkAllMoviesAsWatched(): void {
    this.manageTrackerData.markAllMoviesAsWatched(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllMoviesAsUnwatched(): void {
    this.manageTrackerData.markAllMoviesAsUnwatched(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllSeriesAsWatched(): void {
    this.manageTrackerData.markAllSeriesAsWatched(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllSeriesAsUnwatched(): void {
    this.manageTrackerData.markAllSeriesAsUnwatched(this.selectedOwnerShareCode() || undefined);
  }

  protected onRemoveAllTrackedMovieData(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.removeAllTrackedMovieData();
  }

  protected onRemoveAllTrackedSeriesData(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.removeAllTrackedSeriesData();
  }

  protected onLibraryChange(selectedValue: SelectDataModel['value']): void {
    this.selectedOwnerShareCode.set(typeof selectedValue === 'string' ? selectedValue : '');
  }
}
