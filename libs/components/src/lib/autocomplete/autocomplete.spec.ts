import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete, AutocompleteService } from './autocomplete';

@Component({
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
  imports: [FormField, Autocomplete],
  template: `<libc-autocomplete [formField]="field" placeholder="Search" [showReset]="true"></libc-autocomplete>`,
})
class NoHintHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
}

@Component({
  imports: [FormField, Autocomplete],
  template: `<libc-autocomplete
    [formField]="field"
    placeholder="Search"
    [showReset]="true"
    [autocompleteService]="autocompleteService()"
  ></libc-autocomplete>`,
})
class InputServiceHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
  public readonly autocompleteService = input<{
    getSuggestion: ReturnType<typeof vi.fn>;
    formatSuggestionText?: ReturnType<typeof vi.fn>;
    formatSuggestionValue?: ReturnType<typeof vi.fn>;
  } | null>(null);
}

@Component({
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
    serviceStub.getSuggestion.mockReturnValue(['alpha']);

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'alpha' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(0);
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
  });

  it('does not set suggestions when service returns empty array', () => {
    serviceStub.getSuggestion.mockReturnValue([]);
    component['onKeyup']({
      code: 'KeyZ',
      target: { value: 'z' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual([]);
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
    serviceStub.getSuggestion.mockClear();

    component['onKeyup']({
      code: 'KeyX',
      target: { value: '' },
    } as unknown as KeyboardEvent);

    expect(serviceStub.getSuggestion).not.toHaveBeenCalled();
    expect(component['suggestions']()).toEqual([]);
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
});

describe('Autocomplete component with input service', () => {
  let inputFixture: ComponentFixture<InputServiceHostComponent>;
  let inputComponent: Autocomplete<string>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InputServiceHostComponent],
      providers: [
        { provide: AutocompleteService, useValue: { getSuggestion: vi.fn(), formatSuggestionText: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  it('uses input autocompleteService over injected service', () => {
    const inputServiceStub = {
      getSuggestion: vi.fn().mockReturnValue(['gamma', 'delta']),
      formatSuggestionValue: vi.fn((value: string) => `${value}-input`),
    };

    inputFixture = TestBed.createComponent(InputServiceHostComponent);
    inputFixture.componentRef.setInput('autocompleteService', inputServiceStub);
    inputFixture.detectChanges();

    inputComponent = inputFixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    vi.useFakeTimers();
    inputComponent['onKeyup']({
      code: 'KeyG',
      target: { value: 'g' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    inputFixture.detectChanges();

    expect(inputComponent['suggestions']()).toEqual(['gamma', 'delta']);

    inputComponent['onAcceptSuggestion'](0);
    inputFixture.detectChanges();

    expect(inputFixture.componentInstance.model()).toBe('gamma-input');
    expect(inputServiceStub.getSuggestion).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles observable suggestions from autocompleteService', () => {
    const observableServiceStub = {
      getSuggestion: vi.fn().mockReturnValue(of(['zeta', 'eta'])),
    };

    inputFixture = TestBed.createComponent(InputServiceHostComponent);
    inputFixture.componentRef.setInput('autocompleteService', observableServiceStub);
    inputFixture.detectChanges();

    inputComponent = inputFixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    vi.useFakeTimers();
    inputComponent['onKeyup']({
      code: 'KeyZ',
      target: { value: 'z' },
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(300);
    inputFixture.detectChanges();

    expect(inputComponent['suggestions']()).toEqual(['zeta', 'eta']);
    vi.useRealTimers();
  });
});
