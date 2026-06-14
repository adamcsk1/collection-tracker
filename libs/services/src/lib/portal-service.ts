import { ComponentRef, computed, Injectable, signal, Type, ViewContainerRef } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private readonly portalViewContainerRef = signal<ViewContainerRef | null>(null);
  private readonly componentRefs = signal<ComponentRef<unknown>[]>([]);
  public readonly componentRef = computed(() => this.componentRefs().at(-1) ?? null);

  public setViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.portalViewContainerRef.set(viewContainerRef);
  }

  public open<T = unknown>(component: T, inputs: object = {}): void {
    this.closeAll();
    this.createComponent(component, inputs);
  }

  public openStacked<T = unknown>(component: T, inputs: object = {}): void {
    this.createComponent(component, inputs);
  }

  public closeTop(): void {
    const componentRefs = this.componentRefs();
    const componentRef = componentRefs.at(-1);
    if (!componentRef) return;
    const remainingComponentRefs = componentRefs.slice(0, -1);

    if (remainingComponentRefs.length) {
      this.applyStackState(remainingComponentRefs);
    }

    componentRef.destroy();
    this.componentRefs.set(remainingComponentRefs);
    if (componentRefs.length <= 1) {
      this.portalViewContainerRef()?.clear();
    }
    this.applyStackState();
    this.focusTopDialog();
  }

  public closeAll(): void {
    const componentRefs = this.componentRefs();
    if (!componentRefs.length) return;

    for (const componentRef of componentRefs) {
      componentRef.destroy();
    }
    this.portalViewContainerRef()?.clear();
    this.componentRefs.set([]);
  }

  private createComponent<T = unknown>(component: T, inputs: object = {}): void {
    const viewContainerRef = this.portalViewContainerRef();
    if (!viewContainerRef) {
      throw new Error('Portal host is not ready');
    }

    const componentRef = viewContainerRef.createComponent(component as Type<T>);
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
}
