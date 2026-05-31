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
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, tap } from 'rxjs';
import { TagConfigCard } from './tag-config-card/tag-config-card';
import { TagConfigsExportModel, TagConfigsModel } from './tag-configs-model';
import { TagConfigsService } from './tag-configs-service';
import { tagConfigsStateToken } from './tag-configs-store';

const TAG_CONFIGS_EXPORT_TYPE = 'collection-tracker-tag-configs';
const TAG_CONFIGS_EXPORT_VERSION = 1;

@Component({
  selector: 'ct-tag-configs',
  imports: [Input, TagConfigCard],
  templateUrl: './tag-configs.html',
  styleUrl: './tag-configs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagConfigs {
  private readonly tagConfigsService = inject(TagConfigsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly tagConfigsState = inject(tagConfigsStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly uniqueTags = signal<string[]>([]);
  private readonly tagIgnoreList = [...INTERNAL_USED_TAGS, ...VIRTUAL_TAGS];
  protected readonly translations = {
    exportLabel: computed(() => this.ngxSignalTranslate.translate('Export')),
    importLabel: computed(() => this.ngxSignalTranslate.translate('Import')),
    tagConfig: computed(() => this.ngxSignalTranslate.translate('TagConfig')),
    messageTagConfig: computed(() => this.ngxSignalTranslate.translate('Message.TagConfig')),
    placeholderFilterTags: computed(() => this.ngxSignalTranslate.translate('Placeholder.FilterTags')),
    resetToDefault: computed(() => this.ngxSignalTranslate.translate('ResetToDefault')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly filterText = signal('');
  protected readonly tagConfigs = computed<TagConfigsModel>(() => {
    const storedConfigs = this.tagConfigsState.state.configs();
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
      let storedConfigs = this.tagConfigsState.state.configs();
      const uniqueTags = this.uniqueTags();

      if (uniqueTags.length > 0 && storedConfigs.length > 0) {
        const prunedConfigs = storedConfigs.filter((config) => uniqueTags.includes(config.tag));
        if (prunedConfigs.length !== storedConfigs.length) {
          untracked(() => this.storeTagConfigs(prunedConfigs, false));
        }
        effectRef.destroy();
      }
    });
  }

  protected onTagColorChange(tag: string, color: string): void {
    this.updateTagConfig(tag, { color });
  }

  protected onUseForImageBorderChange(tag: string, useForImageBorder: boolean): void {
    this.updateTagConfig(tag, { useForImageBorder });
  }

  protected onUseForTextColorChange(tag: string, useForTextColor: boolean): void {
    this.updateTagConfig(tag, { useForTextColor });
  }

  protected onUseForImageBadgeChange(tag: string, useForImageBadge: boolean): void {
    this.updateTagConfig(tag, { useForImageBadge });
  }

  protected onWeightChange(tag: string, weight: number | null): void {
    const sanitizedWeight = Number.isFinite(weight) ? Number(weight) : 0;
    this.updateTagConfig(tag, { weight: sanitizedWeight });
  }

  protected onResetTagConfigs(): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.ResetTagConfigs'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.storeTagConfigs([]));
  }

  protected onFilterChange(value: string | null): void {
    this.filterText.set(value ?? '');
  }

  protected onExportTagConfigs(): void {
    const exportData: TagConfigsExportModel = {
      type: TAG_CONFIGS_EXPORT_TYPE,
      version: TAG_CONFIGS_EXPORT_VERSION,
      tagConfigs: this.tagConfigsState.state.configs(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = 'collection-tracker-tag-configs.json';
    anchor.click();
    URL.revokeObjectURL(url);
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigExported'));
  }

  protected onImportTagConfigsClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onImportTagConfigs(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    file
      .text()
      .then((source) => this.importTagConfigs(source))
      .catch(() => this.showImportError());
  }

  private updateTagConfig(
    tag: string,
    changes: {
      color?: string;
      useForImageBorder?: boolean;
      useForTextColor?: boolean;
      useForImageBadge?: boolean;
      weight?: number;
    }
  ): void {
    const storedTagConfigs = this.tagConfigsState.state.configs();
    const existingConfigIndex = storedTagConfigs.findIndex((config) => config.tag === tag);
    const updatedConfigs =
      existingConfigIndex === -1
        ? [
            ...storedTagConfigs,
            {
              tag,
              color: changes.color ?? null,
              useForImageBorder: changes.useForImageBorder ?? false,
              useForTextColor: changes.useForTextColor ?? false,
              useForImageBadge: changes.useForImageBadge ?? false,
              weight: changes.weight ?? 0,
            },
          ]
        : storedTagConfigs.map((config) =>
            config.tag === tag
              ? {
                  ...config,
                  weight: config.weight ?? 0,
                  ...changes,
                }
              : config
          );

    this.storeTagConfigs(updatedConfigs);
  }

  private storeTagConfigs(configs: TagConfigsModel, showSuccessToast = true): void {
    this.tagConfigsService
      .syncUserTagConfigs(configs)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (showSuccessToast) {
            this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigSaved'));
          }
        }),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigSyncError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  private importTagConfigs(source: string): void {
    const importedConfigs = this.parseImportedTagConfigs(source);
    if (!importedConfigs) {
      this.showImportError();
      return;
    }

    const storedConfigs = this.tagConfigsState.state.configs();
    const uniqueImportedConfigs = [...new Map(importedConfigs.map((config) => [config.tag, config])).values()];
    const storedTags = new Set(storedConfigs.map((config) => config.tag));
    const hasConflicts = uniqueImportedConfigs.some((config) => storedTags.has(config.tag));
    const syncImport = (overwriteConflicts: boolean) =>
      this.storeImportedTagConfigs(storedConfigs, uniqueImportedConfigs, overwriteConflicts);

    if (!hasConflicts) {
      syncImport(false);
      return;
    }

    this.confirm
      .open(this.ngxSignalTranslate.translate('Confirm.ImportTagConfigConflicts'))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((overwriteConflicts) => syncImport(overwriteConflicts))
      )
      .subscribe();
  }

  private storeImportedTagConfigs(
    storedConfigs: TagConfigsModel,
    importedConfigs: TagConfigsModel,
    overwriteConflicts: boolean
  ): void {
    const importedConfigByTag = new Map(importedConfigs.map((config) => [config.tag, config]));
    const mergedConfigs = [
      ...storedConfigs.map((config) => (overwriteConflicts ? (importedConfigByTag.get(config.tag) ?? config) : config)),
      ...importedConfigs.filter((config) => !storedConfigs.some((storedConfig) => storedConfig.tag === config.tag)),
    ];

    this.tagConfigsService
      .syncUserTagConfigs(mergedConfigs)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigImported'))),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigSyncError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  private parseImportedTagConfigs(source: string): TagConfigsModel | null {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (!this.isTagConfigsExport(parsed)) return null;
      return parsed.tagConfigs;
    } catch {
      return null;
    }
  }

  private isTagConfigsExport(value: unknown): value is TagConfigsExportModel {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<TagConfigsExportModel>;
    return (
      candidate.type === TAG_CONFIGS_EXPORT_TYPE &&
      candidate.version === TAG_CONFIGS_EXPORT_VERSION &&
      Array.isArray(candidate.tagConfigs) &&
      candidate.tagConfigs.every((config) => this.isTagConfig(config))
    );
  }

  private isTagConfig(value: unknown): value is TagConfigsModel[number] {
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
    this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigImportError'));
  }
}
