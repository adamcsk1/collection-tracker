import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AndroidBackWindow } from './android-back-handler-model';
import { AndroidBackHandlerService } from './android-back-handler-service';

describe('AndroidBackHandlerService', () => {
  let service: AndroidBackHandlerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AndroidBackHandlerService);
    service.listen();
  });

  afterEach(() => {
    document.querySelectorAll('[data-test-id="android-back-test-host"]').forEach((element) => element.remove());
    delete (window as AndroidBackWindow).CollectionTrackerAndroidBack;
  });

  it('returns false from the Android back hook when no dialog is open', () => {
    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack?.()).toBe(false);
  });

  it('does not replace the hook when listening again', () => {
    const hook = (window as AndroidBackWindow).CollectionTrackerAndroidBack;

    service.listen();

    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack).toBe(hook);
  });

  it('removes the hook when the injector is destroyed', () => {
    TestBed.resetTestingModule();

    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack).toBeUndefined();
  });

  it('dispatches Escape to the top open dialog from the Android back hook', () => {
    const inertHost = document.createElement('div');
    inertHost.setAttribute('data-test-id', 'android-back-test-host');
    inertHost.setAttribute('inert', '');
    inertHost.innerHTML = '<div class="dialog-frame"></div>';
    document.body.append(inertHost);

    const openHost = document.createElement('div');
    openHost.setAttribute('data-test-id', 'android-back-test-host');
    openHost.innerHTML = '<div class="dialog-frame"></div>';
    document.body.append(openHost);

    const openDialog = openHost.querySelector<HTMLElement>('.dialog-frame')!;
    const escapeListener = vi.fn();
    openDialog.addEventListener('keydown', escapeListener);

    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack?.()).toBe(true);
    expect(escapeListener).toHaveBeenCalledOnce();
    expect(escapeListener.mock.calls[0][0]).toMatchObject({ key: 'Escape' });
  });

  it('dismisses an open native menu before its parent portal dialog', () => {
    const host = document.createElement('div');
    host.setAttribute('data-test-id', 'android-back-test-host');
    host.innerHTML = '<div class="dialog-frame"><dialog open></dialog></div>';
    document.body.append(host);
    const parent = host.querySelector<HTMLElement>('.dialog-frame')!;
    const menu = host.querySelector('dialog')!;
    const parentEscape = vi.fn();
    parent.addEventListener('keydown', parentEscape);
    const menuEscape = vi.fn((event: KeyboardEvent) => {
      event.stopPropagation();
      menu.removeAttribute('open');
    });
    menu.addEventListener('keydown', menuEscape);

    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack?.()).toBe(true);
    expect(menuEscape).toHaveBeenCalledOnce();
    expect(parentEscape).not.toHaveBeenCalled();
    expect((window as AndroidBackWindow).CollectionTrackerAndroidBack?.()).toBe(true);
    expect(parentEscape).toHaveBeenCalledOnce();
  });
});
