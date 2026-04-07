import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { createFormControlA11y } from '../utils/form-control-a11y-util';
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
  private readonly _a11y = createFormControlA11y(this.checkboxId, this.hint, this.touched, this.dirty, this.errors);
  protected readonly showError = this._a11y.showError;
  protected readonly hintId = this._a11y.hintId;
  protected readonly errorId = this._a11y.errorId;
  protected readonly describedBy = this._a11y.describedBy;
  protected readonly hasRequiredError = this._a11y.hasRequiredError;

  protected onChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.value.set(checked);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }
}
