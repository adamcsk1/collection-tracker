import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu';
import { ActionMenuActionModel } from './action-menu-model';

const actions: ActionMenuActionModel[] = [
  { id: 'tracking-edit', label: 'Edit progress', icon: 'edit' },
  { id: 'tracking-share', label: 'Share progress', icon: 'share' },
  { id: 'tracking-delete', label: 'Delete progress', icon: 'delete', destructive: true },
];

describe('ActionMenu', () => {
  let fixture: ComponentFixture<ActionMenu>;
  let reducedMotion: boolean;

  beforeEach(async () => {
    reducedMotion = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: reducedMotion, media: query }))
    );
    TestBed.configureTestingModule({
      imports: [ActionMenu],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } }],
    });
    fixture = TestBed.createComponent(ActionMenu);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('testIdPrefix', 'tracking');
    fixture.componentRef.setInput('title', 'Progress actions');
    await fixture.whenStable();
    const dialog = getDialog();
    dialog.showModal = vi.fn(() => {
      expect(document.activeElement).toBe(getButton('tracking-more'));
      expect(dialog.hidden).toBe(false);
      dialog.open = true;
    });
    dialog.close = vi.fn(() => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders translated controls, supplied labels and unchanged consumer IDs in a hidden dialog', () => {
    const dialog = getDialog();
    expect(dialog.open).toBe(false);
    expect(dialog.hidden).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe('Progress actions');
    expect(getButton('tracking-more').textContent).toContain('More');
    expect(getButton('tracking-more').getAttribute('aria-haspopup')).toBe('dialog');
    expect(getButton('tracking-more').getAttribute('aria-expanded')).toBe('false');
    expect(getButton('tracking-more-close').getAttribute('aria-label')).toBe('Close');
    expect(getElement('tracking-more-heading').textContent).toContain('Progress actions');
    for (const action of actions) {
      const button = getButton(action.id);
      expect(button.closest('dialog')).toBe(dialog);
      expect(button.getAttribute('aria-label')).toBe(action.label);
      expect(button.getAttribute('title')).toBe(action.label);
      expect(button.querySelector('span')?.textContent).toBe(action.label);
      expect(button.querySelector('i')?.textContent).toBe(action.icon);
      expect(button.querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
    }
    const divider = getButton('tracking-delete').previousElementSibling;
    expect(divider?.tagName).toBe('HR');
    expect(divider?.getAttribute('aria-hidden')).toBe('true');
    expect(getButton('tracking-delete').classList.contains('button-danger')).toBe(true);
  });

  it('groups destructive actions behind one decorative divider and omits it without destructive actions', async () => {
    fixture.componentRef.setInput('actions', [
      actions[2],
      actions[0],
      { id: 'tracking-clear', label: 'Clear progress', icon: 'clear', destructive: true },
    ]);
    await fixture.whenStable();
    expect(getDialog().querySelectorAll('hr')).toHaveLength(1);
    expect(getButton('tracking-delete').previousElementSibling?.tagName).toBe('HR');
    expect(getButton('tracking-clear').previousElementSibling).toBe(getButton('tracking-delete'));

    fixture.componentRef.setInput('actions', [actions[0]]);
    await fixture.whenStable();
    expect(getDialog().querySelector('hr')).toBeNull();
  });

  it('anchors to the trigger and opens only once while already open', async () => {
    const trigger = getButton('tracking-more');
    const dialog = getDialog();
    const viewport = document.documentElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 80, 48));
    trigger.click();
    trigger.click();
    await fixture.whenStable();

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.style.getPropertyValue('--actions-right')).toBe(`${Math.max(16, viewport.clientWidth - 100)}px`);
    expect(dialog.style.getPropertyValue('--actions-bottom')).toBe(`${Math.max(16, viewport.clientHeight - 30 + 8)}px`);
    expect(dialog.open).toBe(true);
    expect(dialog.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes and hides the native dialog before emitting after its exit animation', async () => {
    const dialog = getDialog();
    const selected = vi.fn(() => {
      expect(dialog.open).toBe(false);
      expect(dialog.hidden).toBe(true);
    });
    fixture.componentInstance.selected.subscribe(selected);
    getButton('tracking-more').click();
    await fixture.whenStable();
    getButton('tracking-edit').click();

    expect(dialog.open).toBe(true);
    expect(dialog.hidden).toBe(false);
    expect(dialog.classList.contains('actions-closing')).toBe(true);
    expect(selected).not.toHaveBeenCalled();
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    await fixture.whenStable();

    expect(selected).toHaveBeenCalledExactlyOnceWith('tracking-edit');
    expect(dialog.classList.contains('actions-closing')).toBe(false);
    expect(getButton('tracking-more').getAttribute('aria-expanded')).toBe('false');
  });

  for (const animationName of [
    'actions-popup-leave',
    'actions-sheet-leave',
    '_ngcontent-test_actions-popup-leave',
    '_ngcontent-test_actions-sheet-leave',
  ]) {
    for (const eventType of ['animationend', 'animationcancel']) {
      it(`finishes closing on ${eventType} for ${animationName}`, () => {
        const dialog = getDialog();
        const selected = vi.fn();
        fixture.componentInstance.selected.subscribe(selected);
        getButton('tracking-more').click();
        dispatchAnimation(dialog, eventType, animationName);
        expect(dialog.open).toBe(true);
        getButton('tracking-share').click();
        expect(selected).not.toHaveBeenCalled();

        dispatchAnimation(dialog, eventType, animationName);

        expect(dialog.open).toBe(false);
        expect(dialog.hidden).toBe(true);
        expect(selected).toHaveBeenCalledExactlyOnceWith('tracking-share');
      });
    }
  }

  it('ignores child, backdrop, entry and unrelated animation events', () => {
    const dialog = getDialog();
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    getButton('tracking-more').click();
    getButton('tracking-edit').click();
    dispatchAnimation(getButton('tracking-edit'), 'animationend', 'actions-popup-leave');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave', '::backdrop');
    dispatchAnimation(dialog, 'animationcancel', 'actions-sheet-leave', '::backdrop');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-enter');
    dispatchAnimation(dialog, 'animationcancel', 'actions-sheet-enter');
    dispatchAnimation(dialog, 'animationend', 'unrelated-leave');

    expect(dialog.open).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    expect(selected).toHaveBeenCalledExactlyOnceWith('tracking-edit');
  });

  it('ignores duplicate actions and close requests during exit and after closing, then allows reopening', () => {
    const dialog = getDialog();
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    getButton('tracking-more').click();
    getButton('tracking-edit').click();
    getButton('tracking-edit').click();
    getButton('tracking-share').click();
    getButton('tracking-more-close').click();
    getButton('tracking-more').click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(selected).not.toHaveBeenCalled();

    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    getButton('tracking-share').click();
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledExactlyOnceWith('tracking-edit');

    getButton('tracking-more').click();
    getButton('tracking-share').click();
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    expect(dialog.showModal).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenLastCalledWith('tracking-share');
  });

  it('closes immediately with reduced motion and ignores duplicate selections afterwards', async () => {
    reducedMotion = true;
    const dialog = getDialog();
    const selected = vi.fn(() => {
      expect(dialog.open).toBe(false);
      expect(dialog.hidden).toBe(true);
    });
    fixture.componentInstance.selected.subscribe(selected);
    getButton('tracking-more').click();
    getButton('tracking-delete').click();
    getButton('tracking-delete').click();
    await fixture.whenStable();

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(dialog.classList.contains('actions-closing')).toBe(false);
    expect(selected).toHaveBeenCalledExactlyOnceWith('tracking-delete');
    expect(getButton('tracking-more').getAttribute('aria-expanded')).toBe('false');
  });

  for (const dismissal of ['close', 'escape', 'cancel', 'backdrop']) {
    it(`dismisses with ${dismissal} after exit without emitting a selection`, async () => {
      const dialog = getDialog();
      const selected = vi.fn();
      fixture.componentInstance.selected.subscribe(selected);
      getButton('tracking-more').click();
      if (dismissal === 'close') getButton('tracking-more-close').click();
      if (dismissal === 'escape') {
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        getButton('tracking-more-close').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      if (dismissal === 'cancel') {
        const event = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      if (dismissal === 'backdrop') {
        vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 200, 200));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }));
        expect(dialog.classList.contains('actions-closing')).toBe(false);
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      }
      expect(dialog.open).toBe(true);
      dispatchAnimation(dialog, 'animationend', 'actions-sheet-leave');
      await fixture.whenStable();

      expect(dialog.open).toBe(false);
      expect(dialog.hidden).toBe(true);
      expect(getButton('tracking-more').getAttribute('aria-expanded')).toBe('false');
      expect(selected).not.toHaveBeenCalled();
    });
  }

  it('hides the dialog when native close is dispatched', async () => {
    getButton('tracking-more').click();
    getDialog().close();
    await fixture.whenStable();
    expect(getDialog().hidden).toBe(true);
    expect(getButton('tracking-more').getAttribute('aria-expanded')).toBe('false');
  });

  for (const eventType of ['keydown', 'pointerdown', 'pointerup', 'pointercancel']) {
    it(`stops ${eventType} propagation to the parent dialog`, () => {
      const parentHandler = vi.fn();
      fixture.nativeElement.addEventListener(eventType, parentHandler);
      getButton('tracking-more').click();
      const event =
        eventType === 'keydown'
          ? new KeyboardEvent(eventType, { key: 'Tab', bubbles: true })
          : new Event(eventType, { bubbles: true });
      getButton('tracking-edit').dispatchEvent(event);
      expect(parentHandler).not.toHaveBeenCalled();
      expect(getDialog().open).toBe(true);
    });
  }

  const getElement = (testId: string): HTMLElement => {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-test-id="${testId}"]`);
    if (!element) throw new Error(`Element ${testId} not found`);
    return element;
  };

  const getButton = (testId: string): HTMLButtonElement => getElement(testId) as HTMLButtonElement;
  const getDialog = (): HTMLDialogElement => getElement('tracking-more-actions') as HTMLDialogElement;

  const dispatchAnimation = (target: HTMLElement, eventType: string, animationName: string, pseudoElement = '') => {
    const event = new Event(eventType, { bubbles: true });
    Object.defineProperties(event, {
      animationName: { value: animationName },
      pseudoElement: { value: pseudoElement },
    });
    target.dispatchEvent(event);
  };
});
