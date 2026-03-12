import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { TagConfigsModel } from '@client/tag-configs/tag-configs-model';
import { tagConfigsStateToken } from '@client/tag-configs/tag-configs-store';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { apiStateToken } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_TAG_CONFIGS } from '@shared/constants/storage-const';
import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

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
  private readonly webstorage = inject(WebstorageService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly tagConfigsState = inject(tagConfigsStateToken);
  private readonly uniqueTags = computed(() => [
    ...new Set(
      this.mainCollectionState.state
        .collection()
        .flatMap((item) => item.tags)
        .sort((a, b) => (a.length > b.length ? 1 : b.length > a.length ? -1 : 0))
    ),
  ]);
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
          color: storedConfig?.color ? storedConfig.color : 'transparent',
          useForImageBorder: storedConfig?.useForImageBorder ? storedConfig.useForImageBorder : false,
          useForTextColor: storedConfig?.useForTextColor ? storedConfig.useForTextColor : false,
          useForImageBadge: storedConfig?.useForImageBadge ? storedConfig.useForImageBadge : false,
          weight: storedConfig?.weight ? storedConfig.weight : 0,
        };
      });
  });

  constructor() {
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
              color: changes.color ?? 'transparent',
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
    this.tagConfigsState.setState(
      'configs',
      configs.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    );
    this.webstorage.setItem(STORAGE_TAG_CONFIGS, JSON.stringify(configs));
  }
}
