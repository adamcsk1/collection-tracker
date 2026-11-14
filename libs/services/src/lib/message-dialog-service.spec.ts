import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_DIALOG_COMPONENT } from './message-dialog-const';
import { MessageDialogRequest } from './message-dialog-model';
import { MessageDialogService } from './message-dialog-service';
import { PortalService } from './portal-service';

class DummyMessageDialog {}

describe('MessageDialogService', () => {
  let service: MessageDialogService;
  let request: MessageDialogRequest;
  let openStacked: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openStacked = vi.fn((_component: unknown, inputs: { request: MessageDialogRequest }) => {
      request = inputs.request;
    });
    TestBed.configureTestingModule({
      providers: [
        MessageDialogService,
        { provide: MESSAGE_DIALOG_COMPONENT, useValue: DummyMessageDialog },
        { provide: PortalService, useValue: { openStacked } },
      ],
    });
    service = TestBed.inject(MessageDialogService);
  });

  it('opens the configured component in a stacked portal before subscription', () => {
    const options = { destructive: true, confirmationText: 'Item' } as const;

    service.open({ message: 'Delete?', mode: 'confirm', options });

    expect(openStacked).toHaveBeenCalledWith(DummyMessageDialog, {
      request: { message: 'Delete?', mode: 'confirm', options, resolve: expect.any(Function) },
    });
  });

  it.each([true, false])('emits %s once and completes on resolution', (confirmed) => {
    const next = vi.fn();
    const complete = vi.fn();
    service.open({ message: 'Continue?', mode: 'confirm', options: {} }).subscribe({ next, complete });
    expect(next).not.toHaveBeenCalled();

    request.resolve(confirmed);
    request.resolve(!confirmed);

    expect(next).toHaveBeenCalledExactlyOnceWith(confirmed);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('replays synchronous resolution to late subscribers', () => {
    openStacked.mockImplementation((_component: unknown, inputs: { request: MessageDialogRequest }) => {
      inputs.request.resolve(false);
    });
    const result = service.open({ message: 'Message', mode: 'alert', options: {} });
    const next = vi.fn();
    const complete = vi.fn();

    result.subscribe({ next, complete });

    expect(next).toHaveBeenCalledExactlyOnceWith(false);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('keeps stacked dialog results independent', () => {
    const first = vi.fn();
    const second = vi.fn();
    service.open({ message: 'First', mode: 'info', options: {} }).subscribe(first);
    const firstRequest = request;
    service.open({ message: 'Second', mode: 'confirm', options: {} }).subscribe(second);

    request.resolve(false);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(false);
    firstRequest.resolve(true);
    expect(first).toHaveBeenCalledWith(true);
  });
});
