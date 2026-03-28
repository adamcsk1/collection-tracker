import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  OnInit,
  Renderer2,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { getCoarsePointerBasedDebounceTime } from '@shared/utils/prefer-coarse-pointer-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler, debounceTime, fromEvent, Subject } from 'rxjs';

@Component({
  selector: 'libc-textarea',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Textarea<T> implements FormValueControl<T | null>, OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly textAreaWrapElement = viewChild<ElementRef>('textarea');
  private readonly autoHeightRefreshTrigger = new Subject<void>();
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
  protected readonly showError = computed(() => (this.touched() || this.dirty()) && this.errors().length > 0);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.textareaId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    return this.showError() ? `${this.textareaId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  protected readonly hasRequiredError = computed(
    () => this.showError() && this.errors().some((error) => error.kind === 'required'),
  );

  public ngOnInit(): void {
    if (this.autoHeight()) {
      this.ngZone.runOutsideAngular(() =>
        fromEvent(window, 'resize')
          .pipe(debounceTime(getCoarsePointerBasedDebounceTime()), takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.ngZone.run(() => this.autoHeightRefreshTrigger.next()))
      );

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
        `${this.elementRef!.nativeElement.parentElement!.clientHeight - 16}px`,
      );
    });
  }
}
