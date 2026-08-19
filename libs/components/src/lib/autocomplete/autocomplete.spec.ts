import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete, AutocompleteService } from './autocomplete';

@Component({
  selector: 'libc-autocomplete-test-host',
  imports: [FormField, Autocomplete],
  template: `<libc-autocomplete
    [formField]="field"
    placeholder="Search"
    hint="Helpful"
    [showReset]="true"
  ></libc-autocomplete>`,
})
class HostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model, (path) => required(path));
}

@Component({
  selector: 'libc-autocomplete-no-hint-test-host',
  imports: [FormField, Autocomplete],
  template: `<libc-autocomplete [formField]="field" placeholder="Search" [showReset]="true"></libc-autocomplete>`,
})
class NoHintHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
}

@Component({
  selector: 'libc-autocomplete-top-placement-test-host',
  imports: [FormField, Autocomplete],
  template: `<libc-autocomplete
    [formField]="field"
    placeholder="Search"
    [suggestionListPlacement]="'top'"
  ></libc-autocomplete>`,
})
class TopPlacementHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
}

describe('Autocomplete component', () => {
  let fixture: ComponentFixture<HostComponent>;
  let component: Autocomplete<string>;
  let serviceStub: {
    getSuggestion: ReturnType<typeof vi.fn>;
    formatSuggestionText?: ReturnType<typeof vi.fn>;
    formatSuggestionValue?: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    serviceStub = {
      getSuggestion: vi.fn().mockReturnValue(['alpha', 'beta']),
      formatSuggestionText: vi.fn((value: string) => `*${value}*`),
      formatSuggestionValue: vi.fn((value: string) => `${value}-formatted`),
    };

    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent, TopPlacementHostComponent],
      providers: [
        { provide: AutocompleteService, useValue: serviceStub },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders suggestions and accepts a selection', () => {
    vi.useFakeTimers();
    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual(['alpha', 'beta']);
    expect(component['formatSuggestionText']('alpha')).toBe('*alpha*');

    component['onAcceptSuggestion'](0);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('alpha-formatted');
    expect(component['suggestions']()).toEqual([]);
    vi.useRealTimers();
  });

  it('resets value when reset button is clicked', () => {
    component['onKeyup']({
      code: 'KeyX',
      target: { value: 'x' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['hasValue']()).toBe(true);

    component['onReset']();
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('');
    expect(component['value']()).toBe('');
  });

  it('navigates suggestions with keyboard and accepts selection on Enter', () => {
    const baseEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>;

    vi.useFakeTimers();
    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    component['onKeydown']({
      code: 'ArrowDown',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    component['onKeydown']({
      code: 'ArrowDown',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    component['onKeydown']({
      code: 'Enter',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('beta-formatted');
    expect(component['suggestions']()).toEqual([]);
    vi.useRealTimers();
  });

  it('clears suggestions when Escape is pressed', () => {
    vi.useFakeTimers();
    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(2);

    component['onKeyup']({
      code: 'Escape',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('prevents default behavior on Enter keypress', () => {
    const keyboardEvent = {
      code: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    component['onKeypress'](keyboardEvent);

    expect(keyboardEvent.preventDefault).toHaveBeenCalled();
    expect(keyboardEvent.stopPropagation).toHaveBeenCalled();
  });

  it('does not show suggestions when current value already matches', () => {
    vi.useFakeTimers();
    serviceStub.getSuggestion.mockReturnValue(['alpha']);

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'alpha' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('skips duplicate Tab keydown events', () => {
    component['lastKeycode'] = 'Tab';
    const keyboardEvent = {
      code: 'Tab',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    component['onKeydown'](keyboardEvent);

    expect(component['lastKeycode']).toBe('');
    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('navigates suggestions with arrow keys and clears on blur delay', () => {
    vi.useFakeTimers();
    component['_suggestions'].set(['alpha', 'beta']);

    const baseEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>;
    component['onKeydown']({
      code: 'ArrowDown',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    component['onKeydown']({
      code: 'ArrowDown',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['selectedSuggestion']()).toBe(1);

    component['onBlur']();
    vi.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(component['_suggestions']()).toEqual([]);
    vi.useRealTimers();
  });

  it('moves selection up when ArrowUp is pressed and a selection exists', () => {
    component['_suggestions'].set(['alpha', 'beta']);
    component['selectedSuggestion'].set(1);

    const baseEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>;
    component['onKeydown']({
      code: 'ArrowUp',
      ...baseEvent,
    } as unknown as KeyboardEvent);

    expect(component['selectedSuggestion']()).toBe(0);
  });

  it('does not fetch suggestions when navigating suggestions with arrow keys', () => {
    vi.useFakeTimers();
    component['_suggestions'].set(['alpha', 'beta']);
    serviceStub.getSuggestion.mockClear();

    component['onKeyup']({
      code: 'ArrowDown',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);

    expect(serviceStub.getSuggestion).not.toHaveBeenCalled();
    expect(component['suggestions']()).toEqual(['alpha', 'beta']);
    vi.useRealTimers();
  });

  it('updates internal value when model signal changes externally', () => {
    fixture.componentInstance.model.set('delta');
    fixture.detectChanges();
    expect(component['value']()).toBe('delta');
  });

  it('accepts first suggestion on Tab key when no selection set', () => {
    component['_suggestions'].set(['alpha', 'beta']);

    const baseEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>;
    component['onKeydown']({
      code: 'Tab',
      ...baseEvent,
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('alpha-formatted');
    expect(component['suggestions']()).toEqual([]);
    expect(baseEvent.preventDefault).toHaveBeenCalled();
    expect(baseEvent.stopPropagation).toHaveBeenCalled();
  });

  it('does not intercept Tab when there are no suggestions', () => {
    const keyboardEvent = {
      code: 'Tab',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    component['onKeydown'](keyboardEvent);

    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
    expect(keyboardEvent.stopPropagation).not.toHaveBeenCalled();
    expect(component.value()).toBe('');
  });

  it('does not set suggestions when service returns empty array', () => {
    vi.useFakeTimers();
    serviceStub.getSuggestion.mockReturnValue([]);
    component['onKeyup']({
      code: 'KeyZ',
      target: { value: 'z' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual([]);
    vi.useRealTimers();
  });

  it('marks component touched on blur', () => {
    component['onBlur']();
    expect(component.touched()).toBe(true);
  });

  it('applies focus class when onFocus is triggered', () => {
    component['onFocus']();
    fixture.detectChanges();

    expect(component['focused']()).toBe(true);
  });

  it('uses raw text when formatSuggestionText is not provided', () => {
    serviceStub.formatSuggestionText = undefined;
    expect(component['formatSuggestionText']('plain')).toBe('plain');
  });

  it('uses formatted value when accepting a suggestion', () => {
    vi.useFakeTimers();
    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    component['onAcceptSuggestion'](0);

    expect(fixture.componentInstance.model()).toBe('alpha-formatted');
    expect(serviceStub.formatSuggestionValue).toHaveBeenCalledWith('alpha');
    vi.useRealTimers();
  });

  it('clears suggestions without calling service when input is empty', () => {
    vi.useFakeTimers();
    serviceStub.getSuggestion.mockClear();

    component['onKeyup']({
      code: 'KeyX',
      target: { value: '' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);

    expect(serviceStub.getSuggestion).not.toHaveBeenCalled();
    expect(component['suggestions']()).toEqual([]);
    vi.useRealTimers();
  });

  it('clears suggestions for non-string values', () => {
    const numericComponent = component as unknown as Autocomplete<number>;
    numericComponent.value.set(42);

    numericComponent['getSuggestions']();

    expect(numericComponent['suggestions']()).toEqual([]);
    expect(serviceStub.getSuggestion).not.toHaveBeenCalled();
  });

  it('uses raw suggestion value when value formatter is unavailable', () => {
    serviceStub.formatSuggestionValue = undefined;
    component['_suggestions'].set(['alpha']);

    component['onAcceptSuggestion'](0);

    expect(component.value()).toBe('alpha');
  });

  it('does not prevent non-enter keypresses', () => {
    const keyboardEvent = {
      code: 'KeyA',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    component['onKeypress'](keyboardEvent);

    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
    expect(keyboardEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it('provides hint id in describedBy when hint is set', () => {
    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const noHintComponent = noHintFixture.debugElement.children[0].children[0]
      .componentInstance as Autocomplete<string>;
    expect(noHintComponent['describedBy']()).toBeNull();
  });

  it('emits userEvent when a key is pressed in the input', () => {
    const userEventSpy = vi.fn();
    const unsubscribe = component['userEvent'].subscribe(userEventSpy);

    component['onKeydown']({
      code: 'KeyA',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(userEventSpy).toHaveBeenCalled();
    unsubscribe.unsubscribe();
  });

  it('emits userAcceptSuggestionEvent when a suggestion is accepted', () => {
    const userAcceptSuggestionSpy = vi.fn();
    const unsubscribe = component['userAcceptSuggestionEvent'].subscribe(userAcceptSuggestionSpy);
    component['_suggestions'].set(['alpha', 'beta']);

    component['onAcceptSuggestion'](1);

    expect(userAcceptSuggestionSpy).toHaveBeenCalled();
    expect(component['suggestions']()).toEqual([]);
    unsubscribe.unsubscribe();
  });

  it('uses bottom suggestion placement by default', () => {
    component['_suggestions'].set(['alpha']);
    fixture.detectChanges();

    const suggestionsPane = fixture.nativeElement.querySelector('.input-suggestions-pane') as HTMLDivElement;
    expect(suggestionsPane.classList.contains('input-suggestions-pane-above')).toBe(false);
  });

  it('can show suggestions above the input', () => {
    const topFixture = TestBed.createComponent(TopPlacementHostComponent);
    topFixture.detectChanges();
    const topComponent = topFixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    topComponent['_suggestions'].set(['alpha']);
    topFixture.detectChanges();

    const suggestionsPane = topFixture.nativeElement.querySelector('.input-suggestions-pane') as HTMLDivElement;
    expect(suggestionsPane.classList.contains('input-suggestions-pane-above')).toBe(true);
  });

  it('handles observable suggestions from the injected service', () => {
    serviceStub.getSuggestion.mockReturnValue(of(['zeta', 'eta']));
    vi.useFakeTimers();
    component['onKeyup']({
      code: 'KeyZ',
      target: { value: 'z' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual(['zeta', 'eta']);
    vi.useRealTimers();
  });
});
