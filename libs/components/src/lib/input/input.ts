import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-input',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input<T> implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly hasValue = signal<boolean>(false);
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly type = input<'text' | 'password'>('text');
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly icon = input<string>('');
  public readonly control = input.required<FormControl<T>>();
  public readonly hint = input<string>();

  public ngOnInit(): void {
    this.control()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.hasValue.set(!!value));
  }

  protected onReset(): void {
    this.control().setValue('' as T);
  }
}
