import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      imports: [HostComponent, NoHintHostComponent],
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
    component['onKeyup']({
      code: 'KeyA',
      target: { value: 'a' },
    } as unknown as KeyboardEvent);
    fixture.detectChanges();

    expect(component['suggestions']()).toEqual(['alpha', 'beta']);
    expect(component['formatSuggestionText']('alpha')).toBe('*alpha*');

    component['onAcceptSuggestion'](0);
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('alpha-formatted');
    expect(component['suggestions']()).toEqual([]);
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

    expect(fixture.componentInstance.control.value).toBe('');
    expect(component['value']()).toBe('');
  });

  it('navigates suggestions with keyboard and accepts selection on Enter', () => {
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

    expect(fixture.componentInstance.control.value).toBe('beta-formatted');
    expect(component['suggestions']()).toEqual([]);
  });

  it('clears suggestions when Escape is pressed', () => {
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

  it('updates internal value when control emits changes (ngOnInit path)', () => {
    fixture.componentInstance.control.setValue('delta');
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

    expect(fixture.componentInstance.control.value).toBe('alpha-formatted');
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

  it('disables input via setDisabledState', () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    expect(component['isDisabled']()).toBe(true);
  });

  it('applies focus class when onFocus is triggered', () => {
    component['onFocus']();
    fixture.detectChanges();

    expect(component['focused']()).toBe(true);
  });

  it('clears value and notifies onChange when reset is clicked', () => {
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
    expect(component['formatSuggestionText']('plain')).toBe('plain');
  });

  it('uses formatted value when accepting a suggestion', () => {
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
    noHintFixture.componentInstance.control.setValidators(null);
    noHintFixture.componentInstance.control.markAsPristine();
    noHintFixture.componentInstance.control.markAsUntouched();
    noHintFixture.detectChanges();

    const noHintComponent = noHintFixture.debugElement.children[0].children[0]
      .componentInstance as Autocomplete<string>;
    expect(noHintComponent['describedBy']()).toBeNull();
  });

  it('closes suggestions and refocuses the input', () => {
    component['_suggestions'].set(['alpha', 'beta']);
    const inputEl = (component as any).inputElement().nativeElement as HTMLInputElement;
    const focusSpy = vi.spyOn(inputEl, 'focus');

    component['onCloseSuggestion']();

    expect(component['suggestions']()).toEqual([]);
    expect(focusSpy).toHaveBeenCalled();
  });
});
