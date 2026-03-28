import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { SelectDataModel, SelectInputModel } from '@shared/models/select-model';
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
  protected readonly showError = computed(() => (this.touched() || this.dirty()) && this.errors().length > 0);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.selectId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    return this.showError() ? `${this.selectId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  protected readonly hasRequiredError = computed(
    () => this.showError() && this.errors().some((error) => error.kind === 'required'),
  );
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
