import { TestBed } from '@angular/core/testing';
import { AlertService } from './alert-service';

describe('AlertService', () => {
  let service: AlertService;
  let alertSpy: jest.Mock;

  beforeEach(() => {
    alertSpy = jest.fn();
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
