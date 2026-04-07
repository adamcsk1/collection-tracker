import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { SelectDataModel, SelectInputModel } from '@shared/models/select-model';
import { createFormControlA11y } from '../utils/form-control-a11y-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-select',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select implements FormValueControl<SelectDataModel['value'] | null> {
  public readonly value = model<SelectDataModel['value'] | null>(null);
  public readonly touched = model(false);
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public readonly selectId = input<string>(crypto.randomUUID());
  public readonly options = input.required<SelectInputModel>();
  public readonly mandatory = input<boolean>(false);
  public readonly label = input<string>();
  public readonly hint = input<string>();
  private readonly _a11y = createFormControlA11y(this.selectId, this.hint, this.touched, this.dirty, this.errors);
  protected readonly showError = this._a11y.showError;
  protected readonly hintId = this._a11y.hintId;
  protected readonly errorId = this._a11y.errorId;
  protected readonly describedBy = this._a11y.describedBy;
  protected readonly hasRequiredError = this._a11y.hasRequiredError;
  protected readonly normalizedValue = computed(() => this.normalizeValue(this.value()));

  protected onChangeSelection(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    const selectedOption = this.options().find((option) => this.normalizeValue(option.value) === selectedValue);
    if (selectedOption?.value !== undefined) this.value.set(selectedOption.value);
    else this.value.set(selectedValue);
  }

  protected normalizeValue(value: SelectDataModel['value']): string {
    return `${value ?? ''}`.trim();
  }

  protected isSelected(optionValue: SelectDataModel['value']): boolean {
    return this.normalizeValue(optionValue) === this.normalizedValue();
  }

  protected onBlur(): void {
    this.touched.set(true);
  }
}
