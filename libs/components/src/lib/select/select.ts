import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, FormControl, FormsModule, NgControl, ReactiveFormsModule } from '@angular/forms';
import { SelectInputModel } from '@shared/models/select-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-select',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, FormsModule],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select<T> implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};
  protected readonly value = signal<T | null>(null);
  protected readonly isDisabled = signal(false);
  public readonly selectId = input<string>(crypto.randomUUID());
  public readonly options = input.required<SelectInputModel>();
  public readonly mandatory = input<boolean>(false);
  public readonly label = input<string>();
  public readonly hint = input<string>();
  protected readonly control = computed<FormControl<T> | null>(() => this.ngControl?.control as FormControl<T>);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.selectId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    const control = this.control();
    const hasError = !!control && (control.touched || control.dirty) && !!control.errors;
    return hasError ? `${this.selectId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  public writeValue(value: T | null): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected onChangeSelection(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as unknown as T;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
