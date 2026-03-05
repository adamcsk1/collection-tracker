import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { SelectInputModel } from '@shared/models/select-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-select',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select<T> implements FormValueControl<T | null> {
  public readonly value = model<T | null>(null);
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
    () => this.showError() && this.errors().some((error) => error.kind === 'required')
  );

  protected onChangeSelection(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    const selectedOption = this.options().find((option) => `${option.value}` === selectedValue);
    this.value.set((selectedOption?.value ?? selectedValue) as T);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }
}
