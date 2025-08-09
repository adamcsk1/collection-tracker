import { ComponentRef, Injectable, signal, Type, ViewContainerRef } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private readonly portalViewContainerRef = signal<ViewContainerRef | null>(null);
  private readonly _componentRef = signal<ComponentRef<unknown> | null>(null);
  public readonly componentRef = this._componentRef.asReadonly();

  public setViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.portalViewContainerRef.set(viewContainerRef);
  }

  public open<T = unknown>(component: T, inputs: object = {}): void {
    const componentRef = this.portalViewContainerRef()!.createComponent(component as Type<T>);
    this._componentRef.set(componentRef);

    for (const [key, value] of Object.entries(inputs)) {
      componentRef!.setInput(key, value);
    }
  }

  public close(): void {
    this.portalViewContainerRef()?.clear();
    this._componentRef.set(null);
  }
}
