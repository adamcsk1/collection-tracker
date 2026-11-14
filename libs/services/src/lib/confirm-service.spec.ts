import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmService } from './confirm-service';
import { MessageDialogService } from './message-dialog-service';

describe('ConfirmService', () => {
  let service: ConfirmService;
  let dialogs: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogs = { open: vi.fn(() => of(true)) };
    TestBed.configureTestingModule({
      providers: [ConfirmService, { provide: MessageDialogService, useValue: dialogs }],
    });
    service = TestBed.inject(ConfirmService);
  });

  it('opens a confirmation dialog with default options', async () => {
    expect(await firstValueFrom(service.open('Continue?'))).toBe(true);
    expect(dialogs.open).toHaveBeenCalledWith({ message: 'Continue?', mode: 'confirm', options: {} });
  });

  it('forwards destructive options and cancellation', async () => {
    dialogs.open.mockReturnValue(of(false));
    const options = { destructive: true, confirmationText: 'Item', actionLabel: 'Delete' } as const;

    expect(await firstValueFrom(service.open('Delete item?', options))).toBe(false);
    expect(dialogs.open).toHaveBeenCalledWith({ message: 'Delete item?', mode: 'confirm', options });
  });

  describe('ifConfirmed', () => {
    it('waits for confirmation and forwards options', () => {
      const result = new Subject<boolean>();
      dialogs.open.mockReturnValue(result);
      const subscriber = vi.fn();
      const options = { title: 'Delete' };

      service.ifConfirmed('Delete item?', options).subscribe(subscriber);
      expect(subscriber).not.toHaveBeenCalled();
      result.next(true);

      expect(dialogs.open).toHaveBeenCalledWith({ message: 'Delete item?', mode: 'confirm', options });
      expect(subscriber).toHaveBeenCalledWith(true);
    });

    it('does not emit when user cancels', () => {
      dialogs.open.mockReturnValue(of(false));
      const subscriber = vi.fn();
      const complete = vi.fn();

      service.ifConfirmed('Delete item?').subscribe({ next: subscriber, complete });

      expect(subscriber).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledOnce();
    });
  });
});
