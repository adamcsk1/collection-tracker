import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete, AutocompleteService } from './autocomplete';

@Component({
  imports: [ReactiveFormsModule, Autocomplete],
  template: `<libc-autocomplete
    [formControl]="control"
    placeholder="Search"
    hint="Helpful"
    [showReset]="true"
  ></libc-autocomplete>`,
})
class HostComponent {
  public readonly control = new FormControl('');
}

@Component({
  imports: [ReactiveFormsModule, Autocomplete],
  template: `<libc-autocomplete [formControl]="control" placeholder="Search" [showReset]="true"></libc-autocomplete>`,
})
class NoHintHostComponent {
  public readonly control = new FormControl('');
}

describe('Autocomplete component', () => {
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
      imports: [HostComponent, NoHintHostComponent],
      providers: [
        { provide: AutocompleteService, useValue: serviceStub },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  it('renders suggestions and accepts a selection', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual(['alpha', 'beta']);
    expect(component['formatSuggestionText']('alpha')).toBe('*alpha*');

    component['onAcceptSuggestion'](0);
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('alpha');
    expect(component['suggestions']()).toEqual([]);
  });

  it('resets value when reset button is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component['onKeyup']({
      code: 'KeyX',
      target: { value: 'x' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['hasValue']()).toBe(true);

    component['onReset']();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(component['value']()).toBe('');
  });

  it('navigates suggestions with keyboard and accepts selection on Enter', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    const baseEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>;

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
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

    expect(fixture.componentInstance.control.value).toBe('beta');
    expect(component['suggestions']()).toEqual([]);
  });

  it('clears suggestions when Escape is pressed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(2);

    component['onKeyup']({
      code: 'Escape',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(0);
  });

  it('prevents default behavior on Enter keypress', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
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
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    serviceStub.getSuggestion.mockReturnValue(['alpha']);

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'alpha' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toHaveLength(0);
  });

  it('skips duplicate Tab keydown events', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
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
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
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
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
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

  it('updates internal value when control emits changes (ngOnInit path)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.control.setValue('delta');
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    expect(component['value']()).toBe('delta');
  });

  it('accepts first suggestion on Tab key when no selection set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
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

    expect(fixture.componentInstance.control.value).toBe('alpha');
    expect(component['suggestions']()).toEqual([]);
  });

  it('does not set suggestions when service returns empty array', () => {
    serviceStub.getSuggestion.mockReturnValue([]);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    component['onKeyup']({
      code: 'KeyZ',
      target: { value: 'z' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual([]);
  });

  it('disables input via setDisabledState', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component.setDisabledState(true);
    fixture.detectChanges();

    expect(component['isDisabled']()).toBe(true);
  });

  it('applies focus class when onFocus is triggered', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    component['onFocus']();
    fixture.detectChanges();

    expect(component['focused']()).toBe(true);
  });

  it('clears value and notifies onChange when reset is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    const changeSpy = vi.fn();
    component.registerOnChange(changeSpy);

    component['onKeyup']({
      code: 'KeyT',
      target: { value: 'typed' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    component['onReset']();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(changeSpy).toHaveBeenCalledWith('');
  });

  it('uses raw text when formatSuggestionText is not provided', () => {
    serviceStub.formatSuggestionText = undefined;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    expect(component['formatSuggestionText']('plain')).toBe('plain');
  });

  it('uses formatted value when accepting a suggestion', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    component['onAcceptSuggestion'](0);

    expect(fixture.componentInstance.control.value).toBe('alpha-formatted');
    expect(serviceStub.formatSuggestionValue).toHaveBeenCalledWith('alpha');
  });

  it('clears suggestions without calling service when input is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    serviceStub.getSuggestion.mockClear();

    component['onKeyup']({
      code: 'KeyX',
      target: { value: '' },
    } as unknown as KeyboardEvent);

    expect(serviceStub.getSuggestion).not.toHaveBeenCalled();
    expect(component['suggestions']()).toEqual([]);
  });

  it('provides hint id in describedBy when hint is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setValidators(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    expect(component['describedBy']()).toBeNull();
  });
});
