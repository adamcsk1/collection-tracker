import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
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
  public readonly type = input<'text' | 'password'>('text');
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly icon = input<string>('');
  public readonly hint = input<string>();
  protected readonly showError = computed(() => (this.touched() || this.dirty()) && this.errors().length > 0);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.inputId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    return this.showError() ? `${this.inputId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  protected readonly hasRequiredError = computed(
    () => this.showError() && this.errors().some((error) => error.kind === 'required')
  );

  protected onInput($event: Event): void {
    const target = $event.target as HTMLInputElement;
    this.value.set(target.value as T);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }

  protected onReset(): void {
    this.value.set('' as T);
  }
}
