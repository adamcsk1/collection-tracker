import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'libc-tooltip',
  templateUrl: './tooltip.html',
  styleUrl: './tooltip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tooltip {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tooltip = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly resizeObserver?: ResizeObserver;
  public readonly visible = input(false);
  public readonly text = input.required<string>();
  public readonly tooltipId = input.required<string>();
  public readonly dataTestId = input('tooltip');
  public readonly left = input.required<number>();
  protected readonly resolvedLeft = signal(0);

  constructor() {
    const ResizeObserverConstructor = this.host.nativeElement.ownerDocument.defaultView?.ResizeObserver;
    if (ResizeObserverConstructor) {
      this.resizeObserver = new ResizeObserverConstructor(() => this.updatePosition());
      this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    }

    afterRenderEffect(() => {
      this.text();
      const tooltipElement = this.tooltip()?.nativeElement;
      this.resizeObserver?.disconnect();
      this.resizeObserver?.observe(this.host.nativeElement);
      if (tooltipElement) {
        this.resizeObserver?.observe(tooltipElement);
      }
      this.updatePosition();
    });
  }

  private updatePosition(): void {
    const requestedLeft = this.left();
    const tooltipElement = this.tooltip()?.nativeElement;
    const containerWidth = this.host.nativeElement.clientWidth;
    if (!tooltipElement || !containerWidth) {
      this.resolvedLeft.set(requestedLeft);
      return;
    }

    const halfTooltipWidth = tooltipElement.offsetWidth / 2;
    this.resolvedLeft.set(Math.min(Math.max(requestedLeft, halfTooltipWidth), containerWidth - halfTooltipWidth));
  }
}
