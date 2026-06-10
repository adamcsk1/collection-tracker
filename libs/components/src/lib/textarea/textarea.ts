import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  OnInit,
  Renderer2,
  viewChild,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { createFormControlA11y } from '../utils/form-control-a11y-util';
import { getCoarsePointerBasedDebounceTime } from '@shared/utils/prefer-coarse-pointer-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { asyncScheduler, debounceTime, fromEvent, Subject } from 'rxjs';

@Component({
  selector: 'libc-textarea',
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Textarea<T> implements FormValueControl<T | null>, OnInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly textAreaWrapElement = viewChild<ElementRef>('textarea');
  private readonly autoHeightRefreshTrigger = new Subject<void>();
  protected readonly translations = {
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
  };
  public readonly value = model<T | null>(null);
  public readonly touched = model(false);
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public readonly textareaId = input<string>(crypto.randomUUID());
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly placeholder = input<string>();
  public readonly hint = input<string>();
  public readonly rows = input<number | undefined>();
  public readonly cols = input<number | undefined>();
  public readonly autoHeight = input<boolean>(false);
  private readonly _a11y = createFormControlA11y(this.textareaId, this.hint, this.touched, this.dirty, this.errors);
  protected readonly showError = this._a11y.showError;
  protected readonly hintId = this._a11y.hintId;
  protected readonly errorId = this._a11y.errorId;
  protected readonly describedBy = this._a11y.describedBy;
  protected readonly hasRequiredError = this._a11y.hasRequiredError;

  public ngOnInit(): void {
    if (this.autoHeight()) {
      fromEvent(window, 'resize')
        .pipe(debounceTime(getCoarsePointerBasedDebounceTime()), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.autoHeightRefreshTrigger.next());

      this.autoHeightRefreshTrigger
        .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.setFullHeight());

      this.autoHeightRefreshTrigger.next();
    }
  }

  protected onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.value.set(text as T);
    if (this.autoHeight()) this.autoHeightRefreshTrigger.next();
  }

  protected onBlur(): void {
    this.touched.set(true);
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
