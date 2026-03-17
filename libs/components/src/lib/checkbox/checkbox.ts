import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-checkbox',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkbox implements FormValueControl<boolean | null> {
  public readonly value = model<boolean | null>(null);
  public readonly touched = model(false);
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public readonly checkboxId = input<string>(crypto.randomUUID());
  public readonly label = input.required<string>();
  public readonly mandatory = input<boolean>(false);
  public readonly hint = input<string>();
  protected readonly showError = computed(() => (this.touched() || this.dirty()) && this.errors().length > 0);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.checkboxId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    return this.showError() ? `${this.checkboxId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  protected readonly hasRequiredError = computed(
    () => this.showError() && this.errors().some((error) => error.kind === 'required')
  );

  protected onChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.value.set(checked);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }
}
