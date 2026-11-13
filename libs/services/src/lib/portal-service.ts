import { DOCUMENT } from '@angular/common';
import { ComponentRef, computed, inject, Injectable, signal, Type, ViewContainerRef } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private readonly document = inject(DOCUMENT);
  private readonly portalViewContainerRef = signal<ViewContainerRef | null>(null);
  private readonly componentRefs = signal<ComponentRef<unknown>[]>([]);
  private readonly focusOrigins: (HTMLElement | null)[] = [];
  private readonly focusFallbacks: (() => HTMLElement | null)[] = [];
  public readonly componentRef = computed(() => this.componentRefs().at(-1) ?? null);

  public setViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.portalViewContainerRef.set(viewContainerRef);
  }

  public open<T = unknown>(component: T, inputs: object = {}, focusFallback?: () => HTMLElement | null): void {
    const origin = this.focusOrigins[0] ?? this.currentFocus();
    const fallback = this.focusFallbacks[0] ?? focusFallback;
    this.closeAll();
    this.createComponent(component, inputs, origin, fallback);
  }

  public openStacked<T = unknown>(component: T, inputs: object = {}): void {
    this.createComponent(component, inputs, this.currentFocus());
  }

  public closeTop(): void {
    const componentRefs = this.componentRefs();
    const componentRef = componentRefs.at(-1);
    if (!componentRef) return;
    const remainingComponentRefs = componentRefs.slice(0, -1);
    const origin = this.focusOrigins.pop();
    const fallback = this.focusFallbacks.pop();

    if (remainingComponentRefs.length) {
      this.applyStackState(remainingComponentRefs);
    }

    componentRef.destroy();
    this.componentRefs.set(remainingComponentRefs);
    if (componentRefs.length <= 1) {
      this.portalViewContainerRef()?.clear();
    }
    this.applyStackState();
    const parentHost = remainingComponentRefs.at(-1)?.location.nativeElement as HTMLElement | undefined;
    if (origin?.isConnected && !origin.closest('[inert]') && (!parentHost || parentHost.contains(origin))) {
      origin.focus();
      if (this.document.activeElement === origin) return;
    }
    const fallbackElement = fallback?.();
    if (!parentHost && fallbackElement?.isConnected && !fallbackElement.closest('[inert]')) fallbackElement.focus();
    this.focusTopDialog();
  }

  public closeAll(): void {
    const componentRefs = this.componentRefs();
    if (!componentRefs.length) return;
    const origin = this.focusOrigins[0];
    const fallback = this.focusFallbacks[0];

    for (const componentRef of componentRefs) {
      componentRef.destroy();
    }
    this.portalViewContainerRef()?.clear();
    this.componentRefs.set([]);
    this.focusOrigins.length = 0;
    this.focusFallbacks.length = 0;
    if (origin?.isConnected && !origin.closest('[inert]')) {
      origin.focus();
      if (this.document.activeElement === origin) return;
    }
    const fallbackElement = fallback?.();
    if (fallbackElement?.isConnected && !fallbackElement.closest('[inert]')) fallbackElement.focus();
  }

  private createComponent<T = unknown>(
    component: T,
    inputs: object,
    origin: HTMLElement | null,
    fallback?: () => HTMLElement | null
  ): void {
    const viewContainerRef = this.portalViewContainerRef();
    if (!viewContainerRef) {
      throw new Error('Portal host is not ready');
    }

    const componentRef = viewContainerRef.createComponent(component as Type<T>);
    this.focusOrigins.push(origin);
    this.focusFallbacks.push(fallback ?? (() => null));
    this.componentRefs.update((componentRefs) => [...componentRefs, componentRef]);

    for (const [key, value] of Object.entries(inputs)) {
      componentRef!.setInput(key, value);
    }

    this.applyStackState();
  }

  private applyStackState(componentRefs = this.componentRefs()): void {
    componentRefs.forEach((componentRef, index) => {
      const hostElement = componentRef.location.nativeElement as HTMLElement;
      const isTopDialog = index === componentRefs.length - 1;
      const isStackedTopDialog = isTopDialog && componentRefs.length > 1;
      hostElement.classList.toggle('dialog-stacked', !isTopDialog);
      hostElement.classList.toggle('dialog-stack-top', isStackedTopDialog);
      hostElement.toggleAttribute('inert', !isTopDialog);
      if (isTopDialog) {
        hostElement.removeAttribute('aria-hidden');
      } else {
        hostElement.setAttribute('aria-hidden', 'true');
      }
    });
  }

  private focusTopDialog(): void {
    const hostElement = this.componentRef()?.location.nativeElement as HTMLElement | undefined;
    hostElement?.querySelector<HTMLElement>('.dialog-frame')?.focus();
  }

  private currentFocus(): HTMLElement | null {
    return this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
  }
}
