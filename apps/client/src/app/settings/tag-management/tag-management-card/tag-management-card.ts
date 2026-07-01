import { ChangeDetectionStrategy, Component, input, output, computed, inject, signal } from '@angular/core';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { TagManagementItemModel } from '../tag-management-model';

@Component({
  selector: 'ct-tag-management-card',
  imports: [Checkbox, Input],
  templateUrl: './tag-management-card.html',
  styleUrl: './tag-management-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagManagementCard {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    selectColor: computed(() => this.ngxSignalTranslate.translate('SelectColor')),
    rename: computed(() => this.ngxSignalTranslate.translate('Rename')),
    newTagName: computed(() => this.ngxSignalTranslate.translate('Placeholder.NewTagName')),
    weight: computed(() => this.ngxSignalTranslate.translate('Weight')),
    useTagColorForImageBorder: computed(() => this.ngxSignalTranslate.translate('UseTagColorForImageBorder')),
    useTagColorForTextColor: computed(() => this.ngxSignalTranslate.translate('UseTagColorForTextColor')),
    useTagForImageBadge: computed(() => this.ngxSignalTranslate.translate('UseTagForImageBadge')),
  };
  public readonly tagManagement = input.required<TagManagementItemModel>();
  public readonly colorChange = output<string>();
  public readonly weightChange = output<number | null>();
  public readonly imageBorderChange = output<boolean>();
  public readonly textColorChange = output<boolean>();
  public readonly imageBadgeChange = output<boolean>();
  public readonly rename = output<string>();
  protected readonly renameValue = signal('');

  protected contrastColor(hex: string | null): string | null {
    if (hex === null) return null;
    return getContrastColorHex(hex);
  }

  protected onColorButtonClick(colorInput: HTMLInputElement, color: string | null): void {
    if (color === null) {
      this.colorChange.emit('#000000');
    }
    colorInput.click();
  }

  protected onColorInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.colorChange.emit(target.value);
  }

  protected onWeightChange(weight: number | string | null): void {
    if (weight === null || weight === '') {
      this.weightChange.emit(0);
      return;
    }
    const parsed = Number(weight);
    this.weightChange.emit(Number.isFinite(parsed) ? parsed : 0);
  }

  protected onImageBorderChange(value: boolean | null): void {
    this.imageBorderChange.emit(!!value);
  }

  protected onTextColorChange(value: boolean | null): void {
    this.textColorChange.emit(!!value);
  }

  protected onImageBadgeChange(value: boolean | null): void {
    this.imageBadgeChange.emit(!!value);
  }

  protected onRenameInputChange(value: string | null): void {
    this.renameValue.set(value ?? '');
  }

  protected onRenameClick(): void {
    this.rename.emit(this.renameValue().trim());
  }
}
