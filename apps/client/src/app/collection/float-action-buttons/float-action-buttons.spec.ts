import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { FloatActionButtons } from './float-action-buttons';
import { FloatActionButtonsService } from './float-action-buttons-service';

describe('FloatActionButtons', () => {
  let fixture: ComponentFixture<FloatActionButtons>;
  let component: FloatActionButtons;
  let floatActions: FloatActionsService;
  let actionButtons: FloatActionButtonsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FloatActionButtons],
      providers: [
        FloatActionsService,
        FloatActionButtonsService,
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    fixture = TestBed.createComponent(FloatActionButtons);
    component = fixture.componentInstance;
    floatActions = TestBed.inject(FloatActionsService);
    actionButtons = TestBed.inject(FloatActionButtonsService);
    actionButtons.updateConfig({ showActions: true, collectionLength: 1 });
    fixture.detectChanges();
  });

  it('opens the action menu from the float button', () => {
    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="add-new"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="random-pick"]')).toBeTruthy();
    expect(floatActions.actionButtonsVisible()).toBe(true);
  });

  it('runs registered callbacks and closes the action menu', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      showFunctions: vi.fn(),
    });
    component['onShowFunctions']();

    component['onAddNew']();
    fixture.detectChanges();

    expect(addNew).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeNull();
    expect(floatActions.actionButtonsVisible()).toBe(false);
  });

  it('uses direct add mode when add is the only configured action', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showAiSearchButton: false, showRandomPickButton: false });
    fixture.detectChanges();

    component['onShowFunctions']();

    expect(addNew).toHaveBeenCalledTimes(1);
    expect(floatActions.actionButtonsVisible()).toBe(false);
  });

  it('collapses the action menu when actions reset', () => {
    component['onShowFunctions']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeTruthy();

    actionButtons.reset();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]')).toBeNull();
    expect(floatActions.actionButtonsVisible()).toBe(false);
  });
});
