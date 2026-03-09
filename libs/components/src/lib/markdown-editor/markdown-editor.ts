import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { EasyMdeCtor, EasyMdeInstance } from '@components/markdown-editor/markdown-editor-model';
import { getCoarsePointerBasedDebounceTime } from '@shared/utils/prefer-coarse-pointer-util';
import { asyncScheduler, debounceTime, fromEvent, Subject } from 'rxjs';

@Component({
  selector: 'libc-markdown-editor',
  templateUrl: './markdown-editor.html',
  styleUrl: './markdown-editor.css',
  encapsulation: ViewEncapsulation.None, // ? Required for the locally loaded EasyMDE styles to apply correctly
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownEditor implements FormValueControl<string | null>, OnDestroy, OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);
  private readonly renderer = inject(Renderer2);
  private readonly markdownEditorElement = viewChild<ElementRef<HTMLTextAreaElement>>('markdownEditor');
  private readonly autoHeightRefreshTrigger = new Subject<void>();
  private easyMde: EasyMdeInstance | null = null;
  private disabledState: boolean | undefined = undefined;
  protected easyMdeLoaded = signal(false);
  public readonly value = model<string | null>(null);
  public readonly touched = model(false);
  public readonly editMode = input.required<boolean>();
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly autoHeight = input<boolean>(true);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public readonly editorId = input<string>(crypto.randomUUID());

  constructor() {
    effect(() => {
      this.togglePreview();
    });

    effect(() => {
      if (this.easyMdeLoaded() && this.value() !== this.easyMde?.value()) {
        this.easyMdeLoaded.set(false);
        asyncScheduler.schedule(() => {
          this.easyMde?.value(this.value() ?? '');
          this.easyMdeLoaded.set(true);
        }, 100);
      }
    });

    afterNextRender(async () => {
      await this.initEditor();
      this.updateEditorDisabledState();
    });
  }

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
    }
  }

  public ngOnDestroy(): void {
    this.destroyEditor();
  }

  private async initEditor(): Promise<void> {
    if (this.easyMdeLoaded()) return;
    const easyMdeModule = (await import('easymde')) as unknown as { default?: EasyMdeCtor };
    const EasyMde = easyMdeModule.default ?? (easyMdeModule as unknown as EasyMdeCtor);

    this.easyMde = new EasyMde({
      toolbar: false,
      autoDownloadFontAwesome: false,
      autofocus: true,
      element: this.markdownEditorElement()!.nativeElement,
      initialValue: this.value() ?? '',
      spellChecker: false,
      status: false,
    });

    this.easyMde.codemirror.on('change', () => {
      const rawContent = this.easyMde?.value();
      if (typeof rawContent !== 'string') return;
      this.ngZone.run(() => {
        this.value.set(rawContent);
      });
    });

    this.easyMde.codemirror.on('blur', () => {
      this.ngZone.run(() => this.touched.set(true));
    });

    this.updateEditorDisabledState();
    this.togglePreview();

    if (this.autoHeight()) this.autoHeightRefreshTrigger.next();

    asyncScheduler.schedule(() => this.easyMdeLoaded.set(true), 100);
  }

  private updateEditorDisabledState(): void {
    const editor = this.easyMde;
    const disabled = this.disabled();
    if (!editor || this.disabledState === disabled) return;
    this.disabledState = disabled;
    editor.codemirror.setOption('readOnly', disabled ? 'nocursor' : false);
  }

  private destroyEditor(): void {
    if (!this.easyMde) return;
    this.easyMdeLoaded.set(false);
    this.easyMde.toTextArea();
    this.easyMde.cleanup();
    this.easyMde = null;
  }

  private setFullHeight(): void {
    asyncScheduler.schedule(() => {
      this.renderer.setStyle(
        this.document.querySelector('.CodeMirror '),
        'height',
        `${this.elementRef!.nativeElement.parentElement!.clientHeight - 16}px`
      );
    });
  }

  private togglePreview(): void {
    if (
      (!this.editMode() && !this.easyMde?.isPreviewActive()) ||
      (this.editMode() && this.easyMde?.isPreviewActive())
    ) {
      this.easyMde?.togglePreview();
      this.easyMde?.codemirror.refresh();
    }
  }
}
