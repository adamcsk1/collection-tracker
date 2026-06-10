import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { saveCompanionAppDownload } from '@shared/utils/companion-app-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, tap } from 'rxjs';
import { TagManagementService } from '../tag-management/tag-management-service';
import { tagManagementStateToken } from '../../tag-management/tag-management-store';
import {
  TAG_MANAGEMENT_EXPORT_FILE_NAME,
  TAG_MANAGEMENT_EXPORT_MIME_TYPE,
  TAG_MANAGEMENT_EXPORT_TYPE,
  TAG_MANAGEMENT_EXPORT_VERSION,
} from '../tag-management/tag-management-const';
import { TagManagementExportModel, TagManagementModel } from '../tag-management/tag-management-model';
import { EXPORT_FILE_NAME, EXPORT_MIME_TYPE, EXPORT_TYPE, EXPORT_VERSION } from './export-import-const';

@Component({
  selector: 'ct-export-import',
  imports: [],
  templateUrl: './export-import.html',
  styleUrl: './export-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportImport {
  private readonly api = inject(ApiService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly tagManagementService = inject(TagManagementService);
  private readonly tagManagementState = inject(tagManagementStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly translations = {
    exportImport: computed(() => this.ngxSignalTranslate.translate('ExportImport')),
    export: computed(() => this.ngxSignalTranslate.translate('Export')),
    import: computed(() => this.ngxSignalTranslate.translate('Import')),
    collectionData: computed(() => this.ngxSignalTranslate.translate('CollectionData')),
    tagManagement: computed(() => this.ngxSignalTranslate.translate('TagManagement')),
    messageExportImport: computed(() => this.ngxSignalTranslate.translate('Message.ExportImport')),
    messageCollectionDataExport: computed(() => this.ngxSignalTranslate.translate('Message.CollectionDataExport')),
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
          const envelope = {
            type: EXPORT_TYPE,
            version: EXPORT_VERSION,
            ...exportData,
          };
          const source = JSON.stringify(envelope, null, 2);
          if (saveCompanionAppDownload(EXPORT_FILE_NAME, EXPORT_MIME_TYPE, source)) {
            return;
          }

          const blob = new Blob([source], { type: EXPORT_MIME_TYPE });
          const url = URL.createObjectURL(blob);
          const anchor = this.document.createElement('a');
          anchor.href = url;
          anchor.download = EXPORT_FILE_NAME;
          anchor.click();
          URL.revokeObjectURL(url);
        }),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ExportError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  protected onExportTagManagement(): void {
    const exportData: TagManagementExportModel = {
      type: TAG_MANAGEMENT_EXPORT_TYPE,
      version: TAG_MANAGEMENT_EXPORT_VERSION,
      tagManagement: this.tagManagementState.state.configs(),
    };
    const source = JSON.stringify(exportData, null, 2);
    if (saveCompanionAppDownload(TAG_MANAGEMENT_EXPORT_FILE_NAME, TAG_MANAGEMENT_EXPORT_MIME_TYPE, source)) {
      return;
    }

    const blob = new Blob([source], { type: TAG_MANAGEMENT_EXPORT_MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = TAG_MANAGEMENT_EXPORT_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
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
    const importedConfigs = this.parseImportedTagManagement(source);
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

  private storeImportedTagManagement(
    storedConfigs: TagManagementModel,
    importedConfigs: TagManagementModel,
    overwriteConflicts: boolean
  ): void {
    const importedConfigByTag = new Map(importedConfigs.map((config) => [config.tag, config]));
    const mergedConfigs = [
      ...storedConfigs.map((config) => (overwriteConflicts ? (importedConfigByTag.get(config.tag) ?? config) : config)),
      ...importedConfigs.filter((config) => !storedConfigs.some((storedConfig) => storedConfig.tag === config.tag)),
    ];

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

  private parseImportedTagManagement(source: string): TagManagementModel | null {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (!this.isTagManagementExport(parsed)) return null;
      return parsed.tagManagement;
    } catch {
      return null;
    }
  }

  private isTagManagementExport(value: unknown): value is TagManagementExportModel {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<TagManagementExportModel>;
    return (
      candidate.type === TAG_MANAGEMENT_EXPORT_TYPE &&
      candidate.version === TAG_MANAGEMENT_EXPORT_VERSION &&
      Array.isArray(candidate.tagManagement) &&
      candidate.tagManagement.every((config) => this.isTagManagement(config))
    );
  }

  private isTagManagement(value: unknown): value is TagManagementModel[number] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate['tag'] === 'string' &&
      (typeof candidate['color'] === 'string' || candidate['color'] === null) &&
      typeof candidate['useForImageBorder'] === 'boolean' &&
      typeof candidate['useForTextColor'] === 'boolean' &&
      typeof candidate['useForImageBadge'] === 'boolean' &&
      typeof candidate['weight'] === 'number' &&
      Number.isFinite(candidate['weight'])
    );
  }

  private showImportError(): void {
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementImportError'));
  }
}
