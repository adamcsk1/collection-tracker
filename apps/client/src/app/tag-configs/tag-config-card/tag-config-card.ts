import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { getContrastColorHex } from '@shared/utils/get-contrast-color-hex-util';
import { TagConfigModel } from '../tag-configs-model';

@Component({
  selector: 'ct-tag-config-card',
  imports: [NgxSignalTranslatePipe, Checkbox, Input],
  templateUrl: './tag-config-card.html',
  styleUrl: './tag-config-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagConfigCard {
  public readonly tagConfig = input.required<TagConfigModel>();
  public readonly colorChange = output<string>();
  public readonly weightChange = output<number | null>();
  public readonly imageBorderChange = output<boolean>();
  public readonly textColorChange = output<boolean>();
  public readonly imageBadgeChange = output<boolean>();

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
}
