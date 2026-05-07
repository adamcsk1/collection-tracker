import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiSearchService } from '../../search/ai-search-service';
import { initialMainState, MainState, mainStateToken } from '../../../main/main-store';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { FloatButtons } from './float-buttons';

describe('FloatButtons', () => {
  let fixture: ComponentFixture<FloatButtons>;
  let component: FloatButtons;
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let useAiSearch: ReturnType<typeof signal<boolean | null>>;

  beforeEach(() => {
    useAiSearch = signal<boolean | null>(false);

    TestBed.configureTestingModule({
      imports: [FloatButtons],
      providers: [
        { provide: AiSearchService, useValue: { useAiSearch } },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
      ],
    });

    fixture = TestBed.createComponent(FloatButtons);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken);
    apiState = TestBed.inject(apiStateToken);

    fixture.componentRef.setInput('collectionLength', 0);
    fixture.detectChanges();
  });

  const showButtons = (): void => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const toggleButton = nativeElement.querySelector<HTMLButtonElement>('.float-show-button button');

    toggleButton!.click();
    fixture.detectChanges();
  };

  const findButton = (text: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === text
    );

  it('shows the toggle button and hides the buttons container by default', () => {
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.float-buttons-container')).toBeNull();
  });

  it('shows the buttons container and hides the toggle button when toggle is clicked', () => {
    showButtons();

    expect(fixture.nativeElement.querySelector('.float-buttons-container')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeNull();
  });

  it('emits randomPick and collapses the panel when the random pick button is clicked', () => {
    fixture.componentRef.setInput('collectionLength', 1);
    fixture.detectChanges();
    showButtons();

    const emitted: void[] = [];
    component.randomPick.subscribe(() => emitted.push(undefined));

    findButton('casino')?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeTruthy();
  });

  it('emits addNew and collapses the panel when the add new button is clicked', () => {
    mainState.setState('permissions', { create: true, update: false, delete: false });
    fixture.detectChanges();
    showButtons();

    const emitted: void[] = [];
    component.addNew.subscribe(() => emitted.push(undefined));

    findButton('add')?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeTruthy();
  });

  it('emits toggleAiSearch and collapses the panel when the AI search toggle is clicked', () => {
    mainState.setState('aiAvailable', true);
    fixture.detectChanges();
    showButtons();

    const emitted: void[] = [];
    component.toggleAiSearch.subscribe(() => emitted.push(undefined));

    findButton('search')?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeTruthy();
  });

  it('emits scrollToTop when the scroll to top button is clicked', () => {
    fixture.componentRef.setInput('scrollToTopAvailable', true);
    fixture.detectChanges();

    const emitted: void[] = [];
    component.scrollToTop.subscribe(() => emitted.push(undefined));

    findButton('arrow_upward')?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
  });

  it('shows the scroll to top button even when the function panel is collapsed', () => {
    fixture.componentRef.setInput('scrollToTopAvailable', true);
    fixture.detectChanges();

    expect(findButton('arrow_upward')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.float-show-button')).toBeTruthy();
  });

  it('hides the scroll to top button when scrollToTopAvailable is false', () => {
    expect(findButton('arrow_upward')).toBeUndefined();
  });

  it('hides the add new button when create permission is false', () => {
    showButtons();

    expect(findButton('add')).toBeUndefined();
  });

  it('hides the AI search toggle when aiAvailable is false', () => {
    showButtons();

    expect(findButton('search')).toBeUndefined();
  });

  it('disables the random pick button when the collection is empty', () => {
    showButtons();

    expect(findButton('casino')?.disabled).toBe(true);
  });

  it('enables the random pick button when the collection has items', () => {
    fixture.componentRef.setInput('collectionLength', 1);
    fixture.detectChanges();
    showButtons();

    expect(findButton('casino')?.disabled).toBe(false);
  });

  it('disables action buttons when the API load is pending', () => {
    mainState.setState('aiAvailable', true);
    mainState.setState('permissions', { create: true, update: false, delete: false });
    fixture.componentRef.setInput('collectionLength', 1);
    apiState.setState('loadNetworkStatus', 'pending');
    fixture.detectChanges();
    showButtons();

    expect(findButton('add')?.disabled).toBe(true);
    expect(findButton('search')?.disabled).toBe(true);
    expect(findButton('casino')?.disabled).toBe(true);
  });
});
