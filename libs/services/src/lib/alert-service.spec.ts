import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from './alert-service';
import { MessageDialogService } from './message-dialog-service';

describe('AlertService', () => {
  let service: AlertService;
  let dialogs: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogs = { open: vi.fn(() => of(true)) };
    TestBed.configureTestingModule({
      providers: [AlertService, { provide: MessageDialogService, useValue: dialogs }],
    });
    service = TestBed.inject(AlertService);
  });

  it.each(['show', 'info'] as const)('opens %s immediately with default options', (method) => {
    service[method]('Message');

    expect(dialogs.open).toHaveBeenCalledWith({
      message: 'Message',
      mode: method === 'show' ? 'alert' : 'info',
      options: {},
    });
  });

  it.each(['show', 'info'] as const)('forwards custom labels through %s', (method) => {
    const options = { title: 'Title', actionLabel: 'Continue' };

    service[method]('Message', options);

    expect(dialogs.open).toHaveBeenCalledWith({
      message: 'Message',
      mode: method === 'show' ? 'alert' : 'info',
      options,
    });
  });
});
