import { Component, DestroyRef, ElementRef, inject, input, OnInit, Renderer2, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler, debounceTime, fromEvent } from 'rxjs';

@Component({
  selector: 'libc-textarea',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
})
export class Textarea<T> implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly textAreaWrapElement = viewChild<ElementRef>('textarea');
  public readonly textareaId = input<string>(crypto.randomUUID());
  public readonly label = input<string>('');
  public readonly mandatory = input<boolean>(false);
  public readonly control = input.required<FormControl<T>>();
  public readonly hint = input<string>();
  public readonly rows = input<number | undefined>();
  public readonly cols = input<number | undefined>();
  public readonly autoHeight = input<boolean>(false);

  public ngOnInit(): void {
    if (this.autoHeight()) {
      this.setFullHeight();

      fromEvent(window, 'resize')
        .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.setFullHeight());
    }
  }

  private setFullHeight(): void {
    asyncScheduler.schedule(() =>
      this.renderer.setStyle(
        this.textAreaWrapElement()?.nativeElement,
        'height',
        `${this.elementRef!.nativeElement.parentElement!.clientHeight}px`
      )
    );
  }
}
