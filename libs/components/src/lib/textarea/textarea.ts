import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NgControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler, debounceTime, fromEvent } from 'rxjs';

@Component({
  selector: 'libc-textarea',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Textarea<T> implements ControlValueAccessor, OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly textAreaWrapElement = viewChild<ElementRef>('textarea');
  protected readonly value = signal<string>('');
  public readonly textareaId = input<string>(crypto.randomUUID());
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly hint = input<string>();
  public readonly rows = input<number | undefined>();
  public readonly cols = input<number | undefined>();
  public readonly autoHeight = input<boolean>(false);
  protected readonly control = computed<FormControl<T> | null>(() => this.ngControl?.control as FormControl<T>);
  protected readonly isDisabled = signal(false);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.textareaId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    const control = this.control();
    const hasError = !!control && (control.touched || control.dirty) && !!control.errors;
    return hasError ? `${this.textareaId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  public ngOnInit(): void {
    if (this.autoHeight()) {
      this.setFullHeight();

      fromEvent(window, 'resize')
        .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.setFullHeight());
    }
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

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.value.set(text);
    this.onChange(text as T);
    if (this.autoHeight()) this.setFullHeight();
  }

  protected onBlur(): void {
    this.onTouched();
  }

  private setFullHeight(): void {
    asyncScheduler.schedule(() => {
      this.renderer.setStyle(
        this.textAreaWrapElement()?.nativeElement,
        'height',
        `${this.elementRef!.nativeElement.parentElement!.clientHeight - 16}px`
      );
    });
  }
}
