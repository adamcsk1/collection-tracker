import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { createFormControlA11y } from '../utils/form-control-a11y-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-input',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input<T> implements FormValueControl<T | null> {
  public readonly value = model<T | null>(null);
  public readonly touched = model(false);
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  protected readonly hasValue = computed(() => {
    const value = this.value();
    return value !== null && `${value}`.length > 0;
  });
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly type = input<'text' | 'password' | 'number'>('text');
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly icon = input<string>('');
  public readonly hint = input<string>();
  private readonly _a11y = createFormControlA11y(this.inputId, this.hint, this.touched, this.dirty, this.errors);
  protected readonly showError = this._a11y.showError;
  protected readonly hintId = this._a11y.hintId;
  protected readonly errorId = this._a11y.errorId;
  protected readonly describedBy = this._a11y.describedBy;
  protected readonly hasRequiredError = this._a11y.hasRequiredError;

  protected onInput($event: Event): void {
    const target = $event.target as HTMLInputElement;
    if (this.type() === 'number') {
      if (target.value === '') {
        this.value.set(null as T);
        return;
      }

      const parsedValue = Number(target.value);
      this.value.set((Number.isNaN(parsedValue) ? null : parsedValue) as T);
      return;
    }

    this.value.set(target.value as T);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }

  protected onReset(): void {
    this.value.set((this.type() === 'number' ? null : '') as T);
  }
}
