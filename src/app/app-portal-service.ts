import { ComponentRef, effect, inject, Injectable, signal, ViewContainerRef } from '@angular/core';
import { AppPortalState, appPortalStateToken, initialAppPortalState } from './app-portal-store';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private readonly appPortalState = inject(appPortalStateToken);
  private readonly portalViewContainerRef = signal<ViewContainerRef | null>(null);
  private readonly componentRef = signal<ComponentRef<unknown> | null>(null);

  constructor() {
    // - open
    effect(() => {
      const component = this.appPortalState.state.component();

      if (!component) {
        this.portalViewContainerRef()?.clear();
        this.componentRef.set(null);

        for (const [key, value] of Object.entries(initialAppPortalState)) {
          if (key === 'component') continue;
          this.appPortalState.setState(key as keyof AppPortalState, value);
        }
      } else {
        const componentRef = this.portalViewContainerRef()!.createComponent(component as any); // !! TODO type
        this.componentRef.set(componentRef);

        for (const [key, value] of Object.entries(this.appPortalState.state.inputs())) {
          componentRef!.setInput(key, value);
        }
      }
    });
  }

  public setViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.portalViewContainerRef.set(viewContainerRef);
  }

  public open<T = unknown>(component: T, inputs: object): void {
    this.appPortalState.setState('component', component);
    this.appPortalState.setState('inputs', inputs);
  }

  public close(): void {
    this.appPortalState.setState('component', null);
  }
}
