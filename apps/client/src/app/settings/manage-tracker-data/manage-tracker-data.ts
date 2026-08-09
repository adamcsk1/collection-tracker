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
    markAllMoviesAsCompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllMoviesAsCompleted')),
    markAllMoviesAsUncompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllMoviesAsUncompleted')),
    markAllSeriesAsCompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllSeriesAsCompleted')),
    markAllSeriesAsUncompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllSeriesAsUncompleted')),
    markAllBooksAsCompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllBooksAsCompleted')),
    markAllBooksAsUncompleted: computed(() => this.ngxSignalTranslate.translate('MarkAllBooksAsUncompleted')),
    messageTrackerCleanup: computed(() => this.ngxSignalTranslate.translate('Message.TrackerCleanup')),
    myLibrary: computed(() => this.ngxSignalTranslate.translate('MyLibrary')),
    removeAllTrackedMovieData: computed(() => this.ngxSignalTranslate.translate('RemoveAllTrackedMovieData')),
    removeAllTrackedSeriesData: computed(() => this.ngxSignalTranslate.translate('RemoveAllTrackedSeriesData')),
    removeAllTrackedBookData: computed(() => this.ngxSignalTranslate.translate('RemoveAllTrackedBookData')),
    sharedLibrary: computed(() => this.ngxSignalTranslate.translate('SharedLibrary')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
    books: computed(() => this.ngxSignalTranslate.translate('Books')),
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

  protected onMarkAllMoviesAsCompleted(): void {
    this.manageTrackerData.markAllMoviesAsCompleted(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllMoviesAsUncompleted(): void {
    this.manageTrackerData.markAllMoviesAsUncompleted(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllSeriesAsCompleted(): void {
    this.manageTrackerData.markAllSeriesAsCompleted(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllSeriesAsUncompleted(): void {
    this.manageTrackerData.markAllSeriesAsUncompleted(this.selectedOwnerShareCode() || undefined);
  }

  protected onMarkAllBooksAsCompleted(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.markAllBooksAsCompleted();
  }

  protected onMarkAllBooksAsUncompleted(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.markAllBooksAsUncompleted();
  }

  protected onRemoveAllTrackedMovieData(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.removeAllTrackedMovieData();
  }

  protected onRemoveAllTrackedSeriesData(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.removeAllTrackedSeriesData();
  }

  protected onRemoveAllTrackedBookData(): void {
    if (this.selectedOwnerShareCode()) return;
    this.manageTrackerData.removeAllTrackedBookData();
  }

  protected onLibraryChange(selectedValue: SelectDataModel['value']): void {
    this.selectedOwnerShareCode.set(typeof selectedValue === 'string' ? selectedValue : '');
  }
}
