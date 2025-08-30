import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectInputModel } from '@shared/models/select-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-select',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select<T> {
  public readonly selectId = input<string>(crypto.randomUUID());
  public readonly options = input.required<SelectInputModel>();
  public readonly mandatory = input<boolean>(false);
  public readonly control = input.required<FormControl<T>>();
  public readonly label = input<string>();
  public readonly hint = input<string>();
}
