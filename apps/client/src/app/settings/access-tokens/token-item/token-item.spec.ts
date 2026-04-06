import { TestBed } from '@angular/core/testing';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenItem } from './token-item';

describe('TokenItem component', () => {
  let component: TokenItem;
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [TokenItem],
      providers: [
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(TokenItem, { set: { template: '' } });

    const fixture = TestBed.createComponent(TokenItem);
    fixture.componentRef.setInput('accessToken', {
      tokenHash: 'hash-1',
      createdAt: '2024-01-01',
      userAgent: 'Mozilla',
      expiresAt: null,
    });
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits revokeAccessToken with the tokenHash when user confirms', () => {
    const emitted: string[] = [];
    component.revokeAccessToken.subscribe((value) => emitted.push(value));

    component['onRevokeAccessToken']('hash-1');

    expect(emitted).toEqual(['hash-1']);
  });

  it('does not emit revokeAccessToken when user cancels', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    const emitted: string[] = [];
    component.revokeAccessToken.subscribe((value) => emitted.push(value));

    component['onRevokeAccessToken']('hash-1');

    expect(emitted).toHaveLength(0);
  });
});
