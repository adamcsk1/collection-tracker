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
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY, of, switchMap, tap } from 'rxjs';
import { TagManagementCard } from './tag-management-card/tag-management-card';
import { TagManagementModel } from './tag-management-model';
import { TagManagementService } from './tag-management-service';
import { tagManagementStateToken } from '../../tag-management/tag-management-store';

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
  private readonly uniqueTags = signal<string[]>([]);
  protected readonly translations = {
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
    this.loadUniqueTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

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

  protected onRenameTag(oldTag: string, newTag: string): void {
    const trimmedNewTag = newTag.trim();
    if (!trimmedNewTag) return;

    const sanitizedNewTag = trimmedNewTag.startsWith('#') ? trimmedNewTag : `#${trimmedNewTag}`;
    if (sanitizedNewTag === oldTag) return;

    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.RenameTag', { oldTag, newTag: sanitizedNewTag }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.renameTag(oldTag, sanitizedNewTag));
  }

  protected onFilterChange(value: string | null): void {
    this.filterText.set(value ?? '');
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

  private renameTag(oldTag: string, newTag: string): void {
    this.tagManagementService
      .renameTag(oldTag, newTag)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((response) =>
          response.renamedItemCount === 0 ? of(response) : this.loadUniqueTags().pipe(switchMap(() => of(response)))
        ),
        tap((response) => {
          if (response.renamedItemCount === 0) {
            this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagRenameNoOwnedItems'));
            return;
          }

          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagRenamed'));
        }),
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagRenameError'));
          return EMPTY;
        })
      )
      .subscribe();
  }

  private loadUniqueTags(): ReturnType<ApiService['getStatistics']> {
    return this.api.getStatistics().pipe(
      tap((statistics) => {
        const tags = statistics.charts.tagCounts.map((tagCount) => tagCount.tag);
        this.uniqueTags.set([...new Set(tags)].sort((a, b) => a.length - b.length));
      }),
      catchError(() => {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.LoadStatisticsError'));
        return EMPTY;
      })
    );
  }
}
