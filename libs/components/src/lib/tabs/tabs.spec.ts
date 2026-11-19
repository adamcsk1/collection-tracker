import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TabOption } from './tabs-model';
import { Tabs } from './tabs';

type TestTab = 'first' | 'second' | 'third';

@Component({
  selector: 'libc-tabs-test-host',
  imports: [Tabs],
  template: `
    <libc-tabs
      idPrefix="test-tabs"
      ariaLabel="Test sections"
      [options]="options()"
      [selected]="selected()"
      (selectedChange)="selected.set($event)"
    >
      <ng-container tabs-first-content><p data-test-id="first-content">First content</p></ng-container>
      <ng-container tabs-second-content><p data-test-id="second-content">Second content</p></ng-container>
      <ng-container tabs-third-content><p data-test-id="third-content">Third content</p></ng-container>
    </libc-tabs>
  `,
})
class HostComponent {
  public readonly options = signal<
    | readonly [TabOption<TestTab>, TabOption<TestTab>]
    | readonly [TabOption<TestTab>, TabOption<TestTab>, TabOption<TestTab>]
  >([
    { value: 'first', label: 'First', dataTestId: 'first-tab' },
    { value: 'second', label: 'Second', dataTestId: 'second-tab' },
  ]);
  public readonly selected = signal<TestTab>('first');
}

@Component({
  selector: 'libc-multiple-tabs-test-host',
  imports: [Tabs],
  template: `
    <libc-tabs idPrefix="first-tabs" ariaLabel="First tabs" [options]="options" [selected]="'first'" />
    <libc-tabs idPrefix="second-tabs" ariaLabel="Second tabs" [options]="options" [selected]="'first'" />
  `,
})
class MultipleTabsHostComponent {
  public readonly options: readonly [TabOption<TestTab>, TabOption<TestTab>] = [
    { value: 'first', label: 'First', dataTestId: 'first-tab' },
    { value: 'second', label: 'Second', dataTestId: 'second-tab' },
  ];
}

describe('Tabs component', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, MultipleTabsHostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders accessible tabs and projects both named panel contents', () => {
    const tabList = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    const panels = fixture.nativeElement.querySelectorAll('[role="tabpanel"]') as NodeListOf<HTMLElement>;

    expect(tabList.getAttribute('aria-label')).toBe('Test sections');
    expect(tabList.dataset['testId']).toBe('test-tabs-tabs');
    expect(tabs).toHaveLength(2);
    expect(panels).toHaveLength(2);
    expect(panels[0].querySelector('[data-test-id="first-content"]')?.textContent).toContain('First content');
    expect(panels[1].querySelector('[data-test-id="second-content"]')?.textContent).toContain('Second content');
    expect(tabs[0].getAttribute('aria-controls')).toBe(panels[0].id);
    expect(panels[0].getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].tabIndex).toBe(0);
    expect(tabs[1].tabIndex).toBe(-1);
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
  });

  it('selects a tab when clicked', () => {
    const secondTab = fixture.nativeElement.querySelector('[data-test-id="second-tab"]') as HTMLButtonElement;

    secondTab.click();
    fixture.detectChanges();

    expect(host.selected()).toBe('second');
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    expect((fixture.nativeElement.querySelectorAll('[role="tabpanel"]') as NodeListOf<HTMLElement>)[1].hidden).toBe(
      false
    );
  });

  it('does not select a disabled tab', () => {
    host.options.update((options) => [options[0], { ...options[1], disabled: true }]);
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    tabs[1].click();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(tabs[1].disabled).toBe(true);
    expect(host.selected()).toBe('first');
  });

  it('uses arrow keys to select, focus, and wrap between tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    const moveNext = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });

    tabs[0].dispatchEvent(moveNext);
    fixture.detectChanges();

    expect(moveNext.defaultPrevented).toBe(true);
    expect(host.selected()).toBe('second');
    expect(document.activeElement).toBe(tabs[1]);

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(host.selected()).toBe('first');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('uses Home and End to select and focus the boundary tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('second');
    expect(document.activeElement).toBe(tabs[1]);

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('first');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('does not intercept unrelated keys', () => {
    const firstTab = fixture.nativeElement.querySelector('[role="tab"]') as HTMLButtonElement;
    const tabKey = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

    firstTab.dispatchEvent(tabKey);

    expect(tabKey.defaultPrevented).toBe(false);
    expect(host.selected()).toBe('first');
  });

  it('uses the required prefix to keep separate component ids unique', () => {
    const multipleFixture = TestBed.createComponent(MultipleTabsHostComponent);
    multipleFixture.detectChanges();
    const tabLists = multipleFixture.nativeElement.querySelectorAll('[role="tablist"]') as NodeListOf<HTMLElement>;
    const tabs = multipleFixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    expect(tabLists[0].dataset['testId']).not.toBe(tabLists[1].dataset['testId']);
    expect(tabs[0].id).not.toBe(tabs[2].id);
  });

  it('projects a third panel and navigates all three tabs, skipping disabled options', () => {
    host.options.set([
      { value: 'first', label: 'First', dataTestId: 'first-tab' },
      { value: 'second', label: 'Second', dataTestId: 'second-tab', disabled: true },
      { value: 'third', label: 'Third', dataTestId: 'third-tab' },
    ]);
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    const panels = fixture.nativeElement.querySelectorAll('[role="tabpanel"]') as NodeListOf<HTMLElement>;
    expect(panels).toHaveLength(3);
    expect(panels[2]!.querySelector('[data-test-id="third-content"]')?.textContent).toBe('Third content');
    expect(tabs[2]!.getAttribute('aria-controls')).toBe(panels[2]!.id);
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('third');
    expect(panels[2]!.hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[2]);
    tabs[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('first');
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('third');
    tabs[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('first');
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()).toBe('third');
  });

  it('keeps selection controlled by the parent and can refocus the selected tab after cancellation', () => {
    const tabsFixture = TestBed.createComponent(MultipleTabsHostComponent);
    tabsFixture.detectChanges();
    const buttons = tabsFixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    buttons[1]!.click();
    tabsFixture.detectChanges();
    expect(buttons[0]!.getAttribute('aria-selected')).toBe('true');
    const tabsComponent = tabsFixture.debugElement.children[0]!.componentInstance as Tabs<TestTab>;
    tabsComponent.focusSelected();
    expect(document.activeElement).toBe(buttons[0]);
  });
});
