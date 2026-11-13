import { ComponentRef, Type, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalService } from './portal-service';

class DummyComponent {}

describe('PortalService', () => {
  let service: PortalService;
  let clearSpy: ReturnType<typeof vi.fn>;
  let createComponent: ReturnType<typeof vi.fn>;
  let setInput: ReturnType<typeof vi.fn>;
  let destroy: ReturnType<typeof vi.fn>;
  let viewContainerRef: ViewContainerRef;
  let componentRef: ComponentRef<unknown>;
  let hostElement: HTMLElement;

  beforeEach(() => {
    clearSpy = vi.fn();
    setInput = vi.fn();
    destroy = vi.fn();
    hostElement = document.createElement('div');
    componentRef = { destroy, location: { nativeElement: hostElement }, setInput } as unknown as ComponentRef<unknown>;
    createComponent = vi.fn().mockReturnValue(componentRef);
    viewContainerRef = {
      createComponent: createComponent as unknown as ViewContainerRef['createComponent'],
      clear: clearSpy,
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [PortalService],
    });

    service = TestBed.inject(PortalService);
    service.setViewContainerRef(viewContainerRef);
  });

  it('opens a component and assigns inputs', () => {
    service.open(DummyComponent as Type<unknown>, { foo: 'bar', count: 2 });

    expect(createComponent).toHaveBeenCalledWith(DummyComponent);
    expect(setInput).toHaveBeenCalledWith('foo', 'bar');
    expect(setInput).toHaveBeenCalledWith('count', 2);
    expect(service.componentRef()).toBe(componentRef);
  });

  it('clears the view container and resets the componentRef on close', () => {
    service.open(DummyComponent);
    service.closeTop();

    expect(destroy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(service.componentRef()).toBeNull();
  });

  it('restores the trigger when a portal closes directly', () => {
    const trigger = document.createElement('button');
    const inner = document.createElement('button');
    hostElement.append(inner);
    document.body.append(trigger, hostElement);
    trigger.focus();
    service.open(DummyComponent);
    inner.focus();

    service.closeTop();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    hostElement.remove();
  });

  it.each(['closeTop', 'closeAll'] as const)('uses a fallback for a removed trigger on %s', (close) => {
    const trigger = document.createElement('button');
    const fallback = document.createElement('button');
    document.body.append(trigger, fallback);
    trigger.focus();
    service.open(DummyComponent, {}, () => fallback);
    trigger.remove();

    service[close]();

    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it.each(['closeTop', 'closeAll'] as const)(
    'uses the fallback while a connected trigger is leaving on %s',
    (close) => {
      const leavingMenu = document.createElement('div');
      const trigger = document.createElement('button');
      const fallback = document.createElement('button');
      leavingMenu.append(trigger);
      document.body.append(leavingMenu, fallback);
      trigger.focus();
      service.open(DummyComponent, {}, () => fallback);
      leavingMenu.setAttribute('inert', '');

      service[close]();

      expect(trigger.isConnected).toBe(true);
      expect(document.activeElement).toBe(fallback);
      leavingMenu.remove();
      expect(document.activeElement).toBe(fallback);
      fallback.remove();
    }
  );

  it('prefers the connected trigger over the fallback', () => {
    const trigger = document.createElement('button');
    const fallback = document.createElement('button');
    document.body.append(trigger, fallback);
    trigger.focus();
    service.open(DummyComponent, {}, () => fallback);
    fallback.focus();
    service.closeTop();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    fallback.remove();
  });

  it('restores the original trigger when all portals close', () => {
    const trigger = document.createElement('button');
    const inner = document.createElement('button');
    hostElement.append(inner);
    document.body.append(trigger, hostElement);
    trigger.focus();
    service.open(DummyComponent);
    inner.focus();
    service.openStacked(DummyComponent);

    service.closeAll();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    hostElement.remove();
  });

  it('replaces the active component when opening a regular portal', () => {
    const firstDestroy = vi.fn();
    const firstHostElement = document.createElement('div');
    const firstComponentRef = {
      destroy: firstDestroy,
      location: { nativeElement: firstHostElement },
      setInput,
    } as unknown as ComponentRef<unknown>;
    const secondComponentRef = componentRef;
    createComponent.mockReturnValueOnce(firstComponentRef).mockReturnValueOnce(secondComponentRef);

    service.open(DummyComponent);
    service.open(DummyComponent);

    expect(firstDestroy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(service.componentRef()).toBe(secondComponentRef);
  });

  it('restores the original trigger after replacing a portal', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger, hostElement);
    const inner = document.createElement('button');
    hostElement.append(inner);
    trigger.focus();
    service.open(DummyComponent);
    inner.focus();
    service.open(DummyComponent);

    service.closeAll();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    hostElement.remove();
  });

  it('does not restore a trigger removed during navigation', () => {
    const trigger = document.createElement('button');
    const nextPageControl = document.createElement('button');
    document.body.append(trigger, nextPageControl);
    trigger.focus();
    service.open(DummyComponent);
    trigger.remove();
    nextPageControl.focus();

    service.closeAll();

    expect(document.activeElement).toBe(nextPageControl);
    nextPageControl.remove();
  });

  it('keeps previous components mounted when opening a stacked portal', () => {
    const firstDestroy = vi.fn();
    const firstHostElement = document.createElement('div');
    firstHostElement.innerHTML = '<div class="dialog-frame" tabindex="-1"></div>';
    const firstComponentRef = {
      destroy: firstDestroy,
      location: { nativeElement: firstHostElement },
      setInput,
    } as unknown as ComponentRef<unknown>;
    const secondDestroy = vi.fn();
    const secondHostElement = document.createElement('div');
    document.body.append(firstHostElement, secondHostElement);
    const secondComponentRef = {
      destroy: secondDestroy,
      location: { nativeElement: secondHostElement },
      setInput,
    } as unknown as ComponentRef<unknown>;
    createComponent.mockReturnValueOnce(firstComponentRef).mockReturnValueOnce(secondComponentRef);

    service.open(DummyComponent);
    service.openStacked(DummyComponent);

    expect(firstDestroy).not.toHaveBeenCalled();
    expect(firstHostElement.classList.contains('dialog-stacked')).toBe(true);
    expect(firstHostElement.hasAttribute('inert')).toBe(true);
    expect(firstHostElement.getAttribute('aria-hidden')).toBe('true');
    expect(secondHostElement.classList.contains('dialog-stacked')).toBe(false);
    expect(secondHostElement.classList.contains('dialog-stack-top')).toBe(true);
    expect(service.componentRef()).toBe(secondComponentRef);

    service.closeTop();

    expect(secondDestroy).toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(firstHostElement.classList.contains('dialog-stacked')).toBe(false);
    expect(firstHostElement.classList.contains('dialog-stack-top')).toBe(false);
    expect(firstHostElement.hasAttribute('inert')).toBe(false);
    expect(firstHostElement.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(firstHostElement.querySelector('.dialog-frame'));
    expect(service.componentRef()).toBe(firstComponentRef);
    firstHostElement.remove();
    secondHostElement.remove();
  });

  it.each([false, true])('restores stacked trigger or parent frame when disabled: %s', (disabled) => {
    const parentHost = document.createElement('div');
    parentHost.innerHTML = '<div class="dialog-frame" tabindex="-1"><button>Open</button></div>';
    const trigger = parentHost.querySelector('button') as HTMLButtonElement;
    const parentRef = {
      destroy: vi.fn(),
      location: { nativeElement: parentHost },
      setInput,
    } as unknown as ComponentRef<unknown>;
    const childHost = document.createElement('div');
    childHost.innerHTML = '<button>Child</button>';
    const childRef = {
      destroy: vi.fn(),
      location: { nativeElement: childHost },
      setInput,
    } as unknown as ComponentRef<unknown>;
    document.body.append(parentHost, childHost);
    createComponent.mockReturnValueOnce(parentRef).mockReturnValueOnce(childRef);
    service.open(DummyComponent);
    trigger.focus();
    service.openStacked(DummyComponent);
    trigger.disabled = disabled;
    (childHost.querySelector('button') as HTMLButtonElement).focus();

    service.closeTop();

    expect(document.activeElement).toBe(disabled ? parentHost.querySelector('.dialog-frame') : trigger);
    parentHost.remove();
    childHost.remove();
  });

  it('closes every stacked component when closing all portals', () => {
    const firstDestroy = vi.fn();
    const firstComponentRef = {
      destroy: firstDestroy,
      location: { nativeElement: document.createElement('div') },
      setInput,
    } as unknown as ComponentRef<unknown>;
    const secondDestroy = vi.fn();
    const secondComponentRef = {
      destroy: secondDestroy,
      location: { nativeElement: document.createElement('div') },
      setInput,
    } as unknown as ComponentRef<unknown>;
    createComponent.mockReturnValueOnce(firstComponentRef).mockReturnValueOnce(secondComponentRef);

    service.open(DummyComponent);
    service.openStacked(DummyComponent);
    service.closeAll();

    expect(firstDestroy).toHaveBeenCalled();
    expect(secondDestroy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(service.componentRef()).toBeNull();
  });
});
