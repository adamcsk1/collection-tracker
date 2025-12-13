import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from './alert-service';

describe('AlertService', () => {
  let service: AlertService;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();
    globalThis.alert = alertSpy as unknown as typeof alert;

    TestBed.configureTestingModule({
      providers: [AlertService],
    });

    service = TestBed.inject(AlertService);
  });

  it('shows alert with provided message', () => {
    service.show('Saved!');

    expect(alertSpy).toHaveBeenCalledWith('Saved!');
  });
});
