import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-input',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input<T> {
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly type = input<'text' | 'password'>('text');
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly icon = input<string>('');
  public readonly control = input.required<FormControl<T>>();
  public readonly hint = input<string>();

  protected onReset(): void {
    this.control().setValue('' as T);
  }
}
