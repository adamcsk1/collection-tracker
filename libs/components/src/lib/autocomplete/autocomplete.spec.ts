import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { Autocomplete, AutocompleteService } from './autocomplete';
import { AutocompleteServiceInterface } from './autocomplete-model';

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
  let serviceStub: jest.Mocked<AutocompleteServiceInterface>;

  beforeEach(() => {
    serviceStub = {
      getSuggestion: jest.fn().mockReturnValue(['alpha', 'beta']),
      formatSuggestionText: jest.fn((value: string) => `*${value}*`),
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

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'a';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    fixture.detectChanges();

    const suggestionButtonElements = fixture.nativeElement.querySelectorAll('ul button');
    expect(suggestionButtonElements.length).toBe(2);
    expect(suggestionButtonElements[0].textContent?.trim()).toBe('*alpha*');

    (suggestionButtonElements[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('alpha');
    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('resets value when reset button is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const resetButtonElement = fixture.nativeElement.querySelector('button.button-icon') as HTMLButtonElement;

    inputElement.value = 'x';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX' }));
    fixture.detectChanges();

    expect(resetButtonElement.disabled).toBe(false);
    resetButtonElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(inputElement.value).toBe('');
  });

  it('navigates suggestions with keyboard and accepts selection on Enter', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'a';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    fixture.detectChanges();

    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('beta');
    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('clears suggestions when Escape is pressed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'a';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(2);

    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('prevents default behavior on Enter keypress', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    const keyboardEvent = {
      code: 'Enter',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as KeyboardEvent;

    (component as unknown as { onKeypress(event: KeyboardEvent): void }).onKeypress(keyboardEvent);

    expect(keyboardEvent.preventDefault).toHaveBeenCalled();
    expect(keyboardEvent.stopPropagation).toHaveBeenCalled();
  });

  it('does not show suggestions when current value already matches', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    serviceStub.getSuggestion.mockReturnValue(['alpha']);

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'alpha';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('skips duplicate Tab keydown events', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    (component as unknown as { lastKeycode: string }).lastKeycode = 'Tab';
    const keyboardEvent = {
      code: 'Tab',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as KeyboardEvent;

    (component as unknown as { onKeydown(event: KeyboardEvent): void }).onKeydown(keyboardEvent);

    expect((component as unknown as { lastKeycode: string }).lastKeycode).toBe('');
    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('navigates suggestions with arrow keys and clears on blur delay', () => {
    jest.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    (component as unknown as { _suggestions: { set: (value: string[]) => void } })._suggestions.set(['alpha', 'beta']);

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
    fixture.detectChanges();

    expect((component as unknown as { selectedSuggestion: () => number }).selectedSuggestion()).toBe(1);

    (component as unknown as { onBlur(): void }).onBlur();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    expect((component as unknown as { _suggestions: () => string[] })._suggestions()).toEqual([]);
    jest.useRealTimers();
  });

  it('moves selection up when ArrowUp is pressed and a selection exists', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    (component as unknown as { _suggestions: { set: (value: string[]) => void } })._suggestions.set(['alpha', 'beta']);
    (component as unknown as { selectedSuggestion: { set: (value: number) => void } }).selectedSuggestion.set(1);

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));

    expect((component as unknown as { selectedSuggestion: () => number }).selectedSuggestion()).toBe(0);
  });

  it('updates internal value when control emits changes (ngOnInit path)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.control.setValue('delta');
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    expect((component as unknown as { value: () => string }).value()).toBe('delta');
    expect(fixture.nativeElement.querySelector('input').value).toBe('delta');
  });

  it('accepts first suggestion on Tab key when no selection set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    (component as unknown as { _suggestions: { set: (value: string[]) => void } })._suggestions.set(['alpha', 'beta']);
    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    inputElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('alpha');
    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('does not set suggestions when service returns empty array', () => {
    serviceStub.getSuggestion.mockReturnValue([]);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'z';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('ul button').length).toBe(0);
  });

  it('disables input via setDisabledState', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    component.setDisabledState(true);
    fixture.detectChanges();

    expect(inputElement.disabled).toBe(true);
  });

  it('applies focus class when onFocus is triggered', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    (component as unknown as { onFocus(): void }).onFocus();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.input-box').classList.contains('input-box-focused')).toBe(true);
  });

  it('clears value and notifies onChange when reset is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    const changeSpy = jest.fn();
    component.registerOnChange(changeSpy);

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputElement.value = 'typed';
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT' }));
    fixture.detectChanges();

    const resetButton = fixture.nativeElement.querySelector('button.button-icon') as HTMLButtonElement;
    resetButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(changeSpy).toHaveBeenCalledWith('');
  });

  it('uses raw text when formatSuggestionText is not provided', () => {
    serviceStub.formatSuggestionText = undefined;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Autocomplete<string>;
    expect((component as unknown as { formatSuggestionText(text: string): string }).formatSuggestionText('plain')).toBe(
      'plain'
    );
  });

  it('provides hint id in describedBy when hint is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const hintElement = fixture.nativeElement.querySelector('small') as HTMLElement;

    expect(inputElement.getAttribute('aria-describedby')).toBe(hintElement.id);
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setValidators(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputElement.getAttribute('aria-describedby')).toBeNull();
  });
});
