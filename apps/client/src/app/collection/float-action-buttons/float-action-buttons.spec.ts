import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainState, mainStateToken, type MainState } from '../../main/main-store';
import { FloatActionButtons } from './float-action-buttons';
import { FloatActionButtonsService } from './float-action-buttons-service';

describe('FloatActionButtons', () => {
  let fixture: ComponentFixture<FloatActionButtons>;
  let component: FloatActionButtons;
  let floatActions: FloatActionsService;
  let actionButtons: FloatActionButtonsService;
  let mainState: NgxSimpleSignalStoreService<MainState>;

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
    mainState = TestBed.inject(mainStateToken);
    mainState.setState('aiAvailable', true);
    actionButtons.updateConfig({ showActions: true, collectionLength: 1 });
    fixture.detectChanges();
  });

  it('opens the action menu from the float button', () => {
    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="add-new"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="random-pick"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="add-new"]')?.textContent).toContain('AddNew');
    expect(fixture.nativeElement.querySelector('[data-test-id="random-pick"]')?.textContent).toContain('RandomPick');
    expect(fixture.nativeElement.textContent).toContain('Actions');
    expect(fixture.nativeElement.textContent).not.toContain('Filtering');
    expect(fixture.nativeElement.textContent).not.toContain('Sorting');
    expect(floatActions.actionButtonsVisible()).toBe(true);
  });

  it('shows only section titles for groups with visible actions', () => {
    actionButtons.updateConfig({
      showAddButton: false,
      showAiSearchButton: false,
      showRandomPickButton: false,
      showOrderButtons: true,
      filterActions: ['movie'],
    });
    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Filtering');
    expect(fixture.nativeElement.textContent).toContain('Sorting');
    expect(fixture.nativeElement.textContent).not.toContain('Actions');
  });

  it('runs registered callbacks and closes the action menu', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
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
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showAiSearchButton: false, showRandomPickButton: false });
    fixture.detectChanges();

    component['onShowFunctions']();

    expect(addNew).toHaveBeenCalledTimes(1);
    expect(floatActions.actionButtonsVisible()).toBe(false);
  });

  it('hides the AI search toggle when AI search is unavailable', () => {
    mainState.setState('aiAvailable', false);
    fixture.detectChanges();

    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test-id="ai-search-toggle"]')).toBeNull();
  });

  it('uses direct add mode when AI search is unavailable and random pick is hidden', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showRandomPickButton: false });
    mainState.setState('aiAvailable', false);
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

  it('runs order callbacks from the action menu', () => {
    const toggleOrderBy = vi.fn();
    const toggleOrderDirection = vi.fn();
    actionButtons.setCallbacks({
      addNew: vi.fn(),
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy,
      toggleOrderDirection,
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showOrderButtons: true });
    component['onShowFunctions']();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="list-order-by-toggle"]').click();
    component['onShowFunctions']();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="list-order-direction-toggle"]').click();

    expect(toggleOrderBy).toHaveBeenCalledTimes(1);
    expect(toggleOrderDirection).toHaveBeenCalledTimes(1);
  });

  it('runs filter callbacks from the action menu', () => {
    const applyFilter = vi.fn();
    actionButtons.setCallbacks({
      addNew: vi.fn(),
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter,
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ filterActions: ['movie', 'completed'] });
    component['onShowFunctions']();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="collection-filter-movie"]').click();
    component['onShowFunctions']();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="collection-filter-completed"]').click();

    expect(applyFilter).toHaveBeenNthCalledWith(1, 'movie');
    expect(applyFilter).toHaveBeenNthCalledWith(2, 'completed');
  });

  it('marks active filter actions as current', () => {
    actionButtons.updateConfig({ filterActions: ['movie', 'series'], activeFilterActions: ['movie'] });
    component['onShowFunctions']();
    fixture.detectChanges();

    const movieFilter = fixture.nativeElement.querySelector('[data-test-id="collection-filter-movie"]');
    const seriesFilter = fixture.nativeElement.querySelector('[data-test-id="collection-filter-series"]');

    expect(movieFilter?.textContent).toContain('Movies');
    expect(movieFilter?.getAttribute('aria-current')).toBe('true');
    expect(seriesFilter?.getAttribute('aria-current')).toBeNull();
  });
});
