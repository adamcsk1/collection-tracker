import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Input } from '@components/input/input';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { saveCompanionAppDownload } from '@shared/utils/companion-app-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, tap } from 'rxjs';
import { TagManagementCard } from './tag-management-card/tag-management-card';
import { TagManagementExportModel, TagManagementModel } from './tag-management-model';
import { TagManagementService } from './tag-management-service';
import { tagManagementStateToken } from '../../tag-management/tag-management-store';
import {
  TAG_MANAGEMENT_EXPORT_FILE_NAME,
  TAG_MANAGEMENT_EXPORT_MIME_TYPE,
  TAG_MANAGEMENT_EXPORT_TYPE,
  TAG_MANAGEMENT_EXPORT_VERSION,
} from './tag-management-const';

@Component({
  selector: 'ct-tag-management',
  imports: [Input, TagManagementCard],
  templateUrl: './tag-management.html',
  styleUrl: './tag-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagManagement {
  private readonly tagManagementService = inject(TagManagementService);
  private readonly confirm = inject(ConfirmService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly tagManagementState = inject(tagManagementStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly uniqueTags = signal<string[]>([]);
  private readonly tagIgnoreList = [...INTERNAL_USED_TAGS, ...VIRTUAL_TAGS];
  protected readonly translations = {
    exportLabel: computed(() => this.ngxSignalTranslate.translate('Export')),
    importLabel: computed(() => this.ngxSignalTranslate.translate('Import')),
    tagManagement: computed(() => this.ngxSignalTranslate.translate('TagManagement')),
    messageTagManagement: computed(() => this.ngxSignalTranslate.translate('Message.TagManagement')),
    placeholderFilterTags: computed(() => this.ngxSignalTranslate.translate('Placeholder.FilterTags')),
    resetToDefault: computed(() => this.ngxSignalTranslate.translate('ResetToDefault')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly filterText = signal('');
  protected readonly tagManagement = computed<TagManagementModel>(() => {
    const storedConfigs = this.tagManagementState.state.configs();
    const uniqueTags = this.uniqueTags();
    const filter = this.filterText().trim().toLowerCase();

    return uniqueTags
      .filter((tag) => !this.tagIgnoreList.includes(tag))
      .filter((tag) => tag.toLowerCase().includes(filter))
      .map((tag) => {
        const storedConfig = storedConfigs.find((config) => config.tag === tag);
        return {
          tag,
          color: storedConfig?.color ?? null,
          useForImageBorder: storedConfig?.useForImageBorder ?? false,
          useForTextColor: storedConfig?.useForTextColor ?? false,
          useForImageBadge: storedConfig?.useForImageBadge ?? false,
          weight: storedConfig?.weight ?? 0,
        };
      });
  });

  constructor() {
    this.api
      .getStatistics()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.LoadStatisticsError'));
          return EMPTY;
        })
      )
      .subscribe((statistics) => {
        const tags = statistics.tagCounts.map((tagCount) => tagCount.tag);
        this.uniqueTags.set(
          [...new Set(tags)].sort((a, b) => (a.length > b.length ? 1 : b.length > a.length ? -1 : 0))
        );
      });

    const effectRef = effect(() => {
      let storedConfigs = this.tagManagementState.state.configs();
      const uniqueTags = this.uniqueTags();

      if (uniqueTags.length > 0 && storedConfigs.length > 0) {
        const prunedConfigs = storedConfigs.filter((config) => uniqueTags.includes(config.tag));
        if (prunedConfigs.length !== storedConfigs.length) {
          untracked(() => this.storeTagManagement(prunedConfigs, false));
        }
        effectRef.destroy();
      }
    });
  }

  protected onTagColorChange(tag: string, color: string): void {
    this.updateTagManagement(tag, { color });
  }

  protected onUseForImageBorderChange(tag: string, useForImageBorder: boolean): void {
    this.updateTagManagement(tag, { useForImageBorder });
  }

  protected onUseForTextColorChange(tag: string, useForTextColor: boolean): void {
    this.updateTagManagement(tag, { useForTextColor });
  }

  protected onUseForImageBadgeChange(tag: string, useForImageBadge: boolean): void {
    this.updateTagManagement(tag, { useForImageBadge });
  }

  protected onWeightChange(tag: string, weight: number | null): void {
    const sanitizedWeight = Number.isFinite(weight) ? Number(weight) : 0;
    this.updateTagManagement(tag, { weight: sanitizedWeight });
  }

  protected onResetTagManagement(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.ResetTagManagement'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.storeTagManagement([]));
  }

  protected onFilterChange(value: string | null): void {
    this.filterText.set(value ?? '');
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

  private updateTagManagement(
    tag: string,
    changes: {
      color?: string;
      useForImageBorder?: boolean;
      useForTextColor?: boolean;
      useForImageBadge?: boolean;
      weight?: number;
    }
  ): void {
    const storedTagManagement = this.tagManagementState.state.configs();
    const existingConfigIndex = storedTagManagement.findIndex((config) => config.tag === tag);
    const updatedConfigs =
      existingConfigIndex === -1
        ? [
            ...storedTagManagement,
            {
              tag,
              color: changes.color ?? null,
              useForImageBorder: changes.useForImageBorder ?? false,
              useForTextColor: changes.useForTextColor ?? false,
              useForImageBadge: changes.useForImageBadge ?? false,
              weight: changes.weight ?? 0,
            },
          ]
        : storedTagManagement.map((config) =>
            config.tag === tag
              ? {
                  ...config,
                  weight: config.weight ?? 0,
                  ...changes,
                }
              : config
          );

    this.storeTagManagement(updatedConfigs);
  }

  private storeTagManagement(configs: TagManagementModel, showSuccessToast = true): void {
    this.tagManagementService
      .syncUserTagManagement(configs)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (showSuccessToast) {
            this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementSaved'));
          }
        }),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagManagementSyncError'));
          return EMPTY;
        })
      )
      .subscribe();
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
