import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
} from '@angular/core';
import { asyncScheduler, Subscription } from 'rxjs';
import { Tooltip } from '../tooltip/tooltip';

const holdDuration = 500;
const holdMoveTolerance = 8;
const tooltipDismissDelay = 1000;
const clickSuppressionFallbackDuration = 1000;
let nextTooltipId = 0;

@Directive({
  selector: 'button[libcRevealLabel]',
  host: {
    class: 'button-reveal-label',
  },
})
export class RevealLabel {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly element = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  private readonly document = this.element.nativeElement.ownerDocument;
  private readonly tooltipId = `reveal-label-tooltip-${nextTooltipId++}`;
  private holdSubscription: Subscription | null = null;
  private tooltipDismissSubscription: Subscription | null = null;
  private clickSuppressionSubscription: Subscription | null = null;
  private pointerId: number | null = null;
  private startX: number | null = null;
  private startY: number | null = null;
  private suppressClick = false;
  private tooltipRef: ComponentRef<Tooltip> | null = null;
  private previousDescription: string | null = null;
  public readonly label = input.required<string>({ alias: 'libcRevealLabel' });

  constructor() {
    const button = this.element.nativeElement;
    const onPointerDown = (event: PointerEvent): void => this.onPointerDown(event);
    const onPointerMove = (event: PointerEvent): void => this.onPointerMove(event);
    const onPointerUp = (event: PointerEvent): void => this.onPointerUp(event);
    const onPointerCancel = (): void => this.reset();
    const onClick = (event: MouseEvent): void => this.onClick(event);
    const onContextMenu = (event: MouseEvent): void => {
      if (this.suppressClick) event.preventDefault();
    };
    const onDocumentPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !button.contains(event.target)) this.reset();
    };

    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('pointermove', onPointerMove);
    button.addEventListener('pointerup', onPointerUp);
    button.addEventListener('pointercancel', onPointerCancel);
    button.addEventListener('click', onClick, true);
    button.addEventListener('contextmenu', onContextMenu, true);
    this.document.addEventListener('pointerdown', onDocumentPointerDown, true);
    this.destroyRef.onDestroy(() => {
      this.reset();
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('pointermove', onPointerMove);
      button.removeEventListener('pointerup', onPointerUp);
      button.removeEventListener('pointercancel', onPointerCancel);
      button.removeEventListener('click', onClick, true);
      button.removeEventListener('contextmenu', onContextMenu, true);
      this.document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    });
  }

  private onPointerDown(event: PointerEvent): void {
    this.reset();
    const button = this.element.nativeElement;
    if (button.disabled || event.isPrimary === false || event.pointerType !== 'touch') return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.holdSubscription = asyncScheduler.schedule(() => {
      this.holdSubscription = null;
      if (this.pointerId !== event.pointerId) return;
      this.suppressClick = true;
      this.showTooltip();
    }, holdDuration);
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId || this.startX === null || this.startY === null) return;
    if (
      Math.abs(event.clientX - this.startX) <= holdMoveTolerance &&
      Math.abs(event.clientY - this.startY) <= holdMoveTolerance
    ) {
      return;
    }

    if (this.suppressClick) {
      this.clearHoldSubscription();
      this.startX = null;
      this.startY = null;
      this.clearTooltip();
    } else {
      this.reset();
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;

    this.clearHoldSubscription();
    this.pointerId = null;
    this.startX = null;
    this.startY = null;
    if (!this.suppressClick) return;

    this.tooltipDismissSubscription = asyncScheduler.schedule(() => {
      this.tooltipDismissSubscription = null;
      this.clearTooltip();
    }, tooltipDismissDelay);
    this.clickSuppressionSubscription = asyncScheduler.schedule(() => {
      this.suppressClick = false;
      this.clickSuppressionSubscription = null;
    }, clickSuppressionFallbackDuration);
  }

  private onClick(event: MouseEvent): void {
    if (!this.suppressClick) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.suppressClick = false;
    this.clearClickSuppressionSubscription();
  }

  private showTooltip(): void {
    const button = this.element.nativeElement;
    const container = button.closest<HTMLElement>('.dialog-frame') ?? button.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const tooltipHost = this.document.createElement('libc-tooltip');
    tooltipHost.style.bottom = `${containerRect.bottom - buttonRect.top}px`;
    tooltipHost.style.zIndex = '2';
    tooltipHost.style.translate = `0 calc(-1 * var(--size-2xs))`;
    container.appendChild(tooltipHost);

    const tooltipRef = createComponent(Tooltip, {
      environmentInjector: this.environmentInjector,
      hostElement: tooltipHost,
    });
    tooltipRef.setInput('visible', true);
    tooltipRef.setInput('text', this.label());
    tooltipRef.setInput('tooltipId', this.tooltipId);
    tooltipRef.setInput('dataTestId', 'reveal-label-tooltip');
    tooltipRef.setInput('left', buttonRect.left + buttonRect.width / 2 - containerRect.left);
    this.applicationRef.attachView(tooltipRef.hostView);
    tooltipRef.changeDetectorRef.detectChanges();
    this.tooltipRef = tooltipRef;

    this.previousDescription = button.getAttribute('aria-describedby');
    button.setAttribute('aria-describedby', [this.previousDescription, this.tooltipId].filter(Boolean).join(' '));
  }

  private reset(): void {
    this.clearHoldSubscription();
    this.clearClickSuppressionSubscription();
    this.pointerId = null;
    this.startX = null;
    this.startY = null;
    this.suppressClick = false;
    this.clearTooltip();
  }

  private clearTooltip(): void {
    this.clearTooltipDismissSubscription();
    const hadTooltip = this.tooltipRef !== null;
    if (this.tooltipRef) {
      const tooltipHost = this.tooltipRef.location.nativeElement as HTMLElement;
      this.applicationRef.detachView(this.tooltipRef.hostView);
      this.tooltipRef.destroy();
      tooltipHost.remove();
      this.tooltipRef = null;
    }

    if (hadTooltip) {
      const button = this.element.nativeElement;
      if (this.previousDescription) {
        button.setAttribute('aria-describedby', this.previousDescription);
      } else {
        button.removeAttribute('aria-describedby');
      }
    }
    this.previousDescription = null;
  }

  private clearHoldSubscription(): void {
    this.holdSubscription?.unsubscribe();
    this.holdSubscription = null;
  }

  private clearTooltipDismissSubscription(): void {
    this.tooltipDismissSubscription?.unsubscribe();
    this.tooltipDismissSubscription = null;
  }

  private clearClickSuppressionSubscription(): void {
    this.clickSuppressionSubscription?.unsubscribe();
    this.clickSuppressionSubscription = null;
  }
}
