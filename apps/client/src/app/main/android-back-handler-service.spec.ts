import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidBackHandlerService } from './android-back-handler-service';

type AndroidBackWindow = Window & { CollectionTrackerAndroidBack?: () => boolean };

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
});
