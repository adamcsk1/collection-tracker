import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmService } from './confirm-service';

describe('ConfirmService', () => {
  let service: ConfirmService;
  let confirmSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmSpy = vi.fn();
    globalThis.confirm = confirmSpy as unknown as typeof confirm;

    TestBed.configureTestingModule({
      providers: [ConfirmService],
    });

    service = TestBed.inject(ConfirmService);
  });

  it('returns the confirm response as an observable', async () => {
    confirmSpy.mockReturnValue(true);

    const result = await firstValueFrom(service.open('Proceed?'));

    expect(confirmSpy).toHaveBeenCalledWith('Proceed?');
    expect(result).toBe(true);
  });

  it('returns false when user cancels', async () => {
    confirmSpy.mockReturnValue(false);

    const result = await firstValueFrom(service.open('Are you sure?'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
    expect(result).toBe(false);
  });

  describe('ifConfirmed', () => {
    it('emits when user confirms', async () => {
      confirmSpy.mockReturnValue(true);

      const result = await firstValueFrom(service.ifConfirmed('Delete item?'));

      expect(confirmSpy).toHaveBeenCalledWith('Delete item?');
      expect(result).toBe(true);
    });

    it('does not emit when user cancels', async () => {
      confirmSpy.mockReturnValue(false);
      const subscriber = vi.fn();

      service.ifConfirmed('Delete item?').subscribe(subscriber);

      expect(subscriber).not.toHaveBeenCalled();
    });
  });
});
