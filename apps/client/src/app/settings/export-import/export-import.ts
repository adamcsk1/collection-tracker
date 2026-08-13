import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Callout } from '@components/callout/callout';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { EXPORT_FILE_NAME, EXPORT_MIME_TYPE } from '@shared/constants/export-import-const';
import { UserImportApiRequestModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, forkJoin, of, switchMap, tap } from 'rxjs';
import { CollectionService } from '../../collection/collection-service';
import { SettingsService } from '../settings-service';
import { TagManagementService } from '../tag-management/tag-management-service';
import { tagManagementStateToken } from '../../tag-management/tag-management-store';
import {
  TAG_MANAGEMENT_EXPORT_FILE_NAME,
  TAG_MANAGEMENT_EXPORT_MIME_TYPE,
  TAG_MANAGEMENT_EXPORT_TYPE,
  TAG_MANAGEMENT_EXPORT_VERSION,
} from '../tag-management/tag-management-const';
import { TagManagementExportModel, TagManagementModel } from '../tag-management/tag-management-model';
import { ExportImportService } from './export-import-service';

@Component({
  selector: 'ct-export-import',
  imports: [Callout],
  templateUrl: './export-import.html',
  styleUrl: './export-import.css',
  providers: [ExportImportService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportImport {
  private readonly api = inject(ApiService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly tagManagementService = inject(TagManagementService);
  private readonly settingsService = inject(SettingsService);
  private readonly tagManagementState = inject(tagManagementStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ExportImportService);

  protected readonly translations = {
    exportImport: computed(() => this.ngxSignalTranslate.translate('ExportImport')),
    export: computed(() => this.ngxSignalTranslate.translate('Export')),
    import: computed(() => this.ngxSignalTranslate.translate('Import')),
    importCollectionData: computed(() => this.ngxSignalTranslate.translate('ImportCollectionData')),
    importCollectionItemsByIMDbId: computed(() => this.ngxSignalTranslate.translate('ImportCollectionItemsByIMDbId')),
    collectionData: computed(() => this.ngxSignalTranslate.translate('CollectionData')),
    collectionItemsByIMDbId: computed(() => this.ngxSignalTranslate.translate('CollectionItemsByIMDbId')),
    tagManagement: computed(() => this.ngxSignalTranslate.translate('TagManagement')),
    messageExportImport: computed(() => this.ngxSignalTranslate.translate('Message.ExportImport')),
    messageCollectionDataExport: computed(() => this.ngxSignalTranslate.translate('Message.CollectionDataExport')),
    messageCollectionDataImport: computed(() => this.ngxSignalTranslate.translate('Message.CollectionDataImport')),
    messageCollectionItemsByIMDbIdImport: computed(() =>
      this.ngxSignalTranslate.translate('Message.CollectionItemsByIMDbIdImport')
    ),
    messageExportImportTagManagement: computed(() =>
      this.ngxSignalTranslate.translate('Message.ExportImportTagManagement')
    ),
  };

  protected onExportCollectionData(): void {
    this.api
      .getUserExport()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((exportData) => {
          const source = JSON.stringify(exportData, null, 2);
          this.service.saveDownload(EXPORT_FILE_NAME, EXPORT_MIME_TYPE, source);
        }),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ExportError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  protected onImportCollectionDataClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onImportCollectionData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file
      .text()
      .then((source) => this.importCollectionData(source))
      .catch(() => this.showCollectionDataImportError());
  }

  protected onImportCollectionItemsClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onImportCollectionItems(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file
      .text()
      .then((source) => this.importCollectionItems(source))
      .catch(() => this.showCollectionItemsImportError());
  }

  protected onExportTagManagement(): void {
    const exportData: TagManagementExportModel = {
      type: TAG_MANAGEMENT_EXPORT_TYPE,
      version: TAG_MANAGEMENT_EXPORT_VERSION,
      tagManagement: this.tagManagementState.state.configs(),
    };
    const source = JSON.stringify(exportData, null, 2);
    this.service.saveDownload(TAG_MANAGEMENT_EXPORT_FILE_NAME, TAG_MANAGEMENT_EXPORT_MIME_TYPE, source);
  }

  protected onImportTagManagementClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onImportTagManagement(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file
      .text()
      .then((source) => this.importTagManagement(source))
      .catch(() => this.showImportError());
  }

  private importTagManagement(source: string): void {
    const importedConfigs = this.service.parseImportedTagManagement(source);
    if (!importedConfigs) {
      this.showImportError();
      return;
    }

    const storedConfigs = this.tagManagementState.state.configs();
    const uniqueImportedConfigs = [...new Map(importedConfigs.map((config) => [config.tag, config])).values()];
    const storedTags = new Set(storedConfigs.map((config) => config.tag));
    const hasConflicts = uniqueImportedConfigs.some((config) => storedTags.has(config.tag));
    const syncImport = (overwriteConflicts: boolean) =>
      this.storeImportedTagManagement(storedConfigs, uniqueImportedConfigs, overwriteConflicts);

    if (!hasConflicts) {
      syncImport(false);
      return;
    }

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.ImportTagManagementConflicts'))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((overwriteConflicts) => syncImport(overwriteConflicts))
      )
      .subscribe();
  }

  private importCollectionData(source: string): void {
    let importData: UserImportApiRequestModel;
    try {
      importData = JSON.parse(source) as UserImportApiRequestModel;
    } catch {
      this.showCollectionDataImportError();
      return;
    }

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.ImportCollectionData'))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((confirmed) => {
          if (!confirmed) return;
          this.storeImportedCollectionData(importData);
        })
      )
      .subscribe();
  }

  private storeImportedCollectionData(importData: UserImportApiRequestModel): void {
    this.api
      .importUserExport(importData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          forkJoin([
            this.settingsService.preloadUserSettings(),
            this.tagManagementService.preloadUserTagManagement(),
          ]).pipe(catchError(() => of(null)))
        ),
        tap(() => {
          this.collection.triggerReload();
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CollectionDataImported'));
        }),
        catchError(() => {
          this.showCollectionDataImportError();
          return EMPTY;
        })
      )
      .subscribe();
  }

  private importCollectionItems(source: string): void {
    this.api
      .importCollectionItems(source)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((result) => {
          this.collection.triggerReload();
          this.toastState.setState(
            'message',
            this.ngxSignalTranslate.translate('Toast.CollectionItemsByIMDbIdImported', { ...result })
          );
        }),
        catchError(() => {
          this.showCollectionItemsImportError();
          return EMPTY;
        })
      )
      .subscribe();
  }

  private storeImportedTagManagement(
    storedConfigs: TagManagementModel,
    importedConfigs: TagManagementModel,
    overwriteConflicts: boolean
  ): void {
    const mergedConfigs = this.service.mergeTagManagementConfigs(storedConfigs, importedConfigs, overwriteConflicts);

    this.tagManagementService
      .syncUserTagManagement(mergedConfigs)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() =>
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementImported'))
        ),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementSyncError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  private showImportError(): void {
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementImportError'));
  }

  private showCollectionDataImportError(): void {
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CollectionDataImportError'));
  }

  private showCollectionItemsImportError(): void {
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CollectionItemsByIMDbIdImportError'));
  }
}
