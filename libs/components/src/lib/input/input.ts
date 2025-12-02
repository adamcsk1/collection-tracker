import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, FormControl, NgControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-input',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input<T> implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};
  protected readonly value = signal<string>('');
  protected readonly hasValue = computed(() => !!this.value());
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly type = input<'text' | 'password'>('text');
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly icon = input<string>('');
  public readonly hint = input<string>();
  protected readonly control = computed<FormControl<T> | null>(() => this.ngControl?.control as FormControl<T>);
  protected readonly isDisabled = signal(false);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.inputId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    const control = this.control();
    const hasError = !!control && (control.touched || control.dirty) && !!control.errors;
    return hasError ? `${this.inputId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  public writeValue(value: T | null): void {
    this.value.set((value as string) ?? '');
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

  protected onInput($event: Event): void {
    const target = $event.target as HTMLInputElement;
    this.value.set(target.value);
    this.onChange(target.value as T);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected onReset(): void {
    this.value.set('');
    this.onChange('' as T);
  }
}
