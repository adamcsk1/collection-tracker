import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectInputModel } from '@lib/components/select/select-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-select',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class Select<T> {
  public readonly selectId = input<string>(crypto.randomUUID());
  public readonly options = input.required<SelectInputModel>();
  public readonly label = input.required<string>();
  public readonly mandatory = input<boolean>(false);
  public readonly control = input.required<FormControl<T>>();
  public readonly hint = input<string>();
}
