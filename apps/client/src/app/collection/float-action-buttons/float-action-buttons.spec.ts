import { ComponentRef, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  it('moves focus from the removed opener to the first popup action', async () => {
    actionButtons.updateConfig({ filterActions: ['unwatched', 'favorite'], showOrderButtons: true });
    await fixture.whenStable();
    document.body.append(fixture.nativeElement);
    const opener = fixture.nativeElement.querySelector('[data-test-id="show-functions"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[data-test-id="collection-filter-unwatched"]')
    );
    expect(document.activeElement?.closest('[role="region"]')?.getAttribute('aria-label')).toBe('Actions');
  });

  it('focuses close when all popup actions are disabled', async () => {
    TestBed.inject(apiStateToken).setState('loadNetworkStatus', 'pending');
    await fixture.whenStable();
    document.body.append(fixture.nativeElement);
    const opener = fixture.nativeElement.querySelector('[data-test-id="show-functions"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-test-id="hide-functions"]'));
  });

  it('skips inert actions still present during a previous popup leave animation', async () => {
    document.body.append(fixture.nativeElement);
    const leavingPopup = document.createElement('div');
    leavingPopup.className = 'float-buttons-container';
    leavingPopup.setAttribute('inert', '');
    leavingPopup.append(document.createElement('button'));
    fixture.nativeElement.prepend(leavingPopup);
    const opener = fixture.nativeElement.querySelector('[data-test-id="show-functions"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-test-id="random-pick"]'));
    expect(leavingPopup.contains(document.activeElement)).toBe(false);
  });

  it.each(['hide-functions', 'list-order-by-alphabet', 'list-order-direction-asc', 'collection-filter-favorite'])(
    'restores opener focus after activating %s and makes leaving actions inert',
    async (action) => {
      actionButtons.updateConfig({ showOrderButtons: true, filterActions: ['favorite'] });
      component['onShowFunctions']();
      await fixture.whenStable();
      document.body.append(fixture.nativeElement);
      const popup = fixture.nativeElement.querySelector('.float-buttons-container') as HTMLElement;
      const button = fixture.nativeElement.querySelector(`[data-test-id="${action}"]`) as HTMLButtonElement;
      button.focus();
      button.click();
      await fixture.whenStable();

      expect(popup.hasAttribute('inert')).toBe(true);
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[data-test-id="show-functions"]'));
      expect(floatActions.actionButtonsVisible()).toBe(false);
    }
  );

  it('keeps focus on an already selected sort action without closing the popup', async () => {
    actionButtons.updateConfig({ showOrderButtons: true });
    component['onShowFunctions']();
    await fixture.whenStable();
    document.body.append(fixture.nativeElement);
    const button = fixture.nativeElement.querySelector(
      '[data-test-id="list-order-by-created-at"]'
    ) as HTMLButtonElement;
    button.focus();
    button.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(floatActions.actionButtonsVisible()).toBe(true);
  });

  it('does not steal external focus when showing or hiding functions programmatically', async () => {
    const externalControl = document.createElement('button');
    document.body.append(fixture.nativeElement, externalControl);
    try {
      externalControl.focus();
      component['onShowFunctions']();
      await fixture.whenStable();
      expect(document.activeElement).toBe(externalControl);

      component['onHideFunctions']();
      await fixture.whenStable();
      expect(document.activeElement).toBe(externalControl);
    } finally {
      externalControl.remove();
    }
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
      showRandomPickButton: false,
      showOrderButtons: true,
      filterActions: ['movie'],
    });
    component['onShowFunctions']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Filtering');
    expect(fixture.nativeElement.textContent).toContain('Sorting');
    expect(fixture.nativeElement.textContent).not.toContain('Actions');
    expect(fixture.nativeElement.querySelector('[role="region"]').getAttribute('aria-label')).toBe('Actions');
    expect(
      fixture.nativeElement.querySelector('[data-test-id="list-order-direction-desc"]').getAttribute('aria-label')
    ).toBe('SortDescendingShort - SwitchToDescendingOrder');
    expect(
      fixture.nativeElement.querySelector('[data-test-id="list-order-direction-asc"]').getAttribute('aria-label')
    ).toBe('SortAscendingShort - SwitchToAscendingOrder');
  });

  it('runs registered callbacks and closes the action menu', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
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

  it('keeps Add visible and supplies it as the focus fallback', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    component['onShowFunctions']();
    fixture.detectChanges();
    const leavingMenu = fixture.nativeElement.querySelector('.float-buttons-container') as HTMLElement;
    (fixture.nativeElement.querySelector('[data-test-id="add-new"]') as HTMLButtonElement).click();
    expect(leavingMenu.hasAttribute('inert')).toBe(true);
    fixture.detectChanges();

    expect(addNew.mock.calls[0][0]()).toBe(fixture.nativeElement.querySelector('[data-test-id="add-new"]'));
  });

  it.each(['closeTop', 'closeAll'] as const)(
    'restores focus when the portal closes before the opener renders via %s',
    (close) => {
      const portal = TestBed.inject(PortalService);
      const dialog = document.createElement('button');
      const dialogRef = {
        destroy: () => dialog.remove(),
        location: { nativeElement: dialog },
        setInput: vi.fn(),
      } as unknown as ComponentRef<unknown>;
      portal.setViewContainerRef({ createComponent: () => dialogRef, clear: vi.fn() } as unknown as ViewContainerRef);
      actionButtons.setCallbacks({
        addNew: (fallback) => {
          portal.open(class {}, {}, fallback);
          document.body.append(dialog);
          dialog.focus();
        },
        randomPick: vi.fn(),
        toggleOrderBy: vi.fn(),
        toggleOrderDirection: vi.fn(),
        applyFilter: vi.fn(),
        showFunctions: vi.fn(),
      });
      document.body.append(fixture.nativeElement);
      component['onShowFunctions']();
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector('[data-test-id="add-new"]') as HTMLButtonElement;
      trigger.focus();
      trigger.click();
      expect(fixture.nativeElement.querySelector('[data-test-id="show-functions"]')).toBeNull();

      portal[close]();

      expect(document.activeElement).toBe(trigger);
      fixture.nativeElement.remove();
    }
  );

  it('uses direct add mode when add is the only configured action', () => {
    const addNew = vi.fn();
    actionButtons.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showRandomPickButton: false });
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
      toggleOrderBy,
      toggleOrderDirection,
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showOrderButtons: true });
    component['onShowFunctions']();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="list-order-by-alphabet"]').click();
    component['onShowFunctions']();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="list-order-direction-asc"]').click();

    expect(toggleOrderBy).toHaveBeenCalledTimes(1);
    expect(toggleOrderDirection).toHaveBeenCalledTimes(1);
  });

  it('marks active sorting actions as current', () => {
    actionButtons.updateConfig({ showOrderButtons: true, orderBy: 'createdAt', orderDirection: 'desc' });
    component['onShowFunctions']();
    fixture.detectChanges();

    const createdAtOrder = fixture.nativeElement.querySelector('[data-test-id="list-order-by-created-at"]');
    const alphabetOrder = fixture.nativeElement.querySelector('[data-test-id="list-order-by-alphabet"]');
    const descendingOrder = fixture.nativeElement.querySelector('[data-test-id="list-order-direction-desc"]');
    const ascendingOrder = fixture.nativeElement.querySelector('[data-test-id="list-order-direction-asc"]');

    expect(createdAtOrder?.textContent).toContain('SortCreatedAtShort');
    expect(alphabetOrder?.textContent).toContain('SortAlphabetShort');
    expect(descendingOrder?.textContent).toContain('SortDescendingShort');
    expect(ascendingOrder?.textContent).toContain('SortAscendingShort');
    expect(createdAtOrder?.textContent).not.toContain('SwitchToCreatedAtOrder');
    expect(alphabetOrder?.textContent).not.toContain('SwitchToAlphabetOrder');
    expect(descendingOrder?.textContent).not.toContain('SwitchToDescendingOrder');
    expect(ascendingOrder?.textContent).not.toContain('SwitchToAscendingOrder');
    expect(createdAtOrder?.getAttribute('aria-label')).toBe('SortCreatedAtShort - SwitchToCreatedAtOrder');
    expect(alphabetOrder?.getAttribute('aria-label')).toBe('SortAlphabetShort - SwitchToAlphabetOrder');
    expect(descendingOrder?.getAttribute('aria-label')).toBe('SortDescendingShort - SwitchToDescendingOrder');
    expect(ascendingOrder?.getAttribute('aria-label')).toBe('SortAscendingShort - SwitchToAscendingOrder');
    expect(createdAtOrder?.getAttribute('title')).toBe('SwitchToCreatedAtOrder');
    expect(alphabetOrder?.getAttribute('title')).toBe('SwitchToAlphabetOrder');
    expect(descendingOrder?.getAttribute('title')).toBe('SwitchToDescendingOrder');
    expect(ascendingOrder?.getAttribute('title')).toBe('SwitchToAscendingOrder');
    expect(createdAtOrder?.getAttribute('aria-current')).toBe('true');
    expect(alphabetOrder?.getAttribute('aria-current')).toBeNull();
    expect(descendingOrder?.getAttribute('aria-current')).toBe('true');
    expect(ascendingOrder?.getAttribute('aria-current')).toBeNull();
  });

  it('does not run order callbacks when active sorting actions are clicked', () => {
    const toggleOrderBy = vi.fn();
    const toggleOrderDirection = vi.fn();
    actionButtons.setCallbacks({
      addNew: vi.fn(),
      randomPick: vi.fn(),
      toggleOrderBy,
      toggleOrderDirection,
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ showOrderButtons: true, orderBy: 'createdAt', orderDirection: 'desc' });
    component['onShowFunctions']();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="list-order-by-created-at"]').click();
    fixture.nativeElement.querySelector('[data-test-id="list-order-direction-desc"]').click();

    expect(toggleOrderBy).not.toHaveBeenCalled();
    expect(toggleOrderDirection).not.toHaveBeenCalled();
  });

  it('runs filter callbacks from the action menu', () => {
    const applyFilter = vi.fn();
    actionButtons.setCallbacks({
      addNew: vi.fn(),
      randomPick: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter,
      showFunctions: vi.fn(),
    });
    actionButtons.updateConfig({ filterActions: ['movie', 'favorite'] });
    component['onShowFunctions']();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-test-id="collection-filter-movie"]').click();
    component['onShowFunctions']();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-test-id="collection-filter-favorite"]').click();

    expect(applyFilter).toHaveBeenNthCalledWith(1, 'movie');
    expect(applyFilter).toHaveBeenNthCalledWith(2, 'favorite');
  });

  it('marks active filter actions as current', () => {
    actionButtons.updateConfig({ filterActions: ['movie', 'favorite'], activeFilterActions: ['favorite'] });
    component['onShowFunctions']();
    fixture.detectChanges();

    const movieFilter = fixture.nativeElement.querySelector('[data-test-id="collection-filter-movie"]');
    const favoriteFilter = fixture.nativeElement.querySelector('[data-test-id="collection-filter-favorite"]');

    expect(movieFilter?.textContent).toContain('Movies');
    expect(favoriteFilter?.textContent).toContain('Favorites');
    expect(movieFilter?.getAttribute('aria-current')).toBeNull();
    expect(favoriteFilter?.getAttribute('aria-current')).toBe('true');
  });

  it('renders movie and series filters in a row while keeping other filters stacked', () => {
    actionButtons.updateConfig({ filterActions: ['movie', 'series', 'unwatched', 'favorite'] });
    component['onShowFunctions']();
    fixture.detectChanges();

    const filterRow = fixture.nativeElement.querySelector('.float-action-row');

    expect(filterRow.querySelector('[data-test-id="collection-filter-movie"]')).toBeTruthy();
    expect(filterRow.querySelector('[data-test-id="collection-filter-series"]')).toBeTruthy();
    expect(filterRow.querySelector('[data-test-id="collection-filter-unwatched"]')).toBeNull();
    expect(filterRow.querySelector('[data-test-id="collection-filter-favorite"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="collection-filter-unwatched"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="collection-filter-favorite"]')).toBeTruthy();
  });
});
