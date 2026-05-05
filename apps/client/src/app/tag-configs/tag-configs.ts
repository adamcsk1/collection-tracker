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
import { ApiService } from '@services/api/api-service';
import { TagConfigsModel } from './tag-configs-model';
import { tagConfigsStateToken } from './tag-configs-store';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { toastStateToken } from '@components/toast/toast-store';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY } from 'rxjs';
import { TagConfigsService } from './tag-configs-service';

@Component({
  selector: 'ct-tag-configs',
  imports: [NgxSignalTranslatePipe, Checkbox, Input],
  templateUrl: './tag-configs.html',
  styleUrl: './tag-configs.css',
  host: {
    class: 'page',
  },
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
  private readonly uniqueTags = signal<string[]>([]);
  private readonly tagIgnoreList = [...INTERNAL_USED_TAGS, ...VIRTUAL_TAGS];
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly tagConfigs = computed<TagConfigsModel>(() => {
    const storedConfigs = this.tagConfigsState.state.configs();
    const uniqueTags = this.uniqueTags();

    return uniqueTags
      .filter((tag) => !this.tagIgnoreList.includes(tag))
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

      if (uniqueTags.length > 0) {
        storedConfigs = storedConfigs.filter((config) => uniqueTags.includes(config.tag));
        untracked(() => this.storeTagConfigs(storedConfigs));
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
      .subscribe(() => this.storeTagConfigs([]));
  }

  protected contrastColor(hex: string | null): string | null {
    if (hex === null) return null;
    return getContrastColorHex(hex);
  }

  protected onSetDefaultTagColor(tag: string, color: string | null): void {
    if (color === null) {
      this.onTagColorChange(tag, '#000000');
    }
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

  private storeTagConfigs(configs: TagConfigsModel): void {
    this.tagConfigsService
      .syncUserTagConfigs(configs)
      .pipe(
        catchError(() => {
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.TagConfigSyncError'));
          return EMPTY;
        })
      )
      .subscribe();
  }
}
