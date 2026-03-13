import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { Select } from './select';

@Component({
  imports: [FormField, Select],
  template: `<libc-select
    [formField]="field"
    [options]="options"
    label="Choose"
    [labelIcon]="'info'"
    [labelIconHint]="'Select help'"
    hint="Pick one"
  ></libc-select>`,
})
class HostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model, (path) => required(path));
  public readonly options = [
    { text: 'One', value: '1' },
    { text: 'Two', value: '2' },
  ];
}

@Component({
  imports: [FormField, Select],
  template: `<libc-select [formField]="field" [options]="options" label="Choose"></libc-select>`,
})
class NoHintHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
  public readonly options = [
    { text: 'One', value: '1' },
    { text: 'Two', value: '2' },
  ];
}

@Component({
  imports: [FormField, Select],
  template: `<libc-select [formField]="field" [options]="options" label="Choose"></libc-select>`,
})
class NumberHostComponent {
  public readonly model = signal<1 | 2 | null>(1);
  public readonly field = form(this.model, (path) => required(path));
  public readonly options = [
    { text: 'One', value: 1 },
    { text: 'Two', value: 2 },
  ];
}

@Component({
  imports: [FormField, Select],
  template: `<libc-select [formField]="field" [options]="options" label="Choose"></libc-select>`,
})
class WhitespaceHostComponent {
  public readonly model = signal('Alpha');
  public readonly field = form(this.model, (path) => required(path));
  public readonly options = [
    { text: 'A', value: '  Alpha  ' },
    { text: 'B', value: '  Beta  ' },
  ];
}

describe('Select component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent, NumberHostComponent, WhitespaceHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders options and updates the field value on change', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Select;
    const options = component.options().map((option) => option.value);

    expect(options).toEqual(['1', '2']);

    component['onChangeSelection']({
      target: { value: '2' },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('2');
  });

  it('connects hint id to describedBy', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Select;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('marks the field as touched when blurred', () => {
    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select;

    componentInstance['onBlur']();

    expect(componentInstance.touched()).toBe(true);
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Select;
    expect(component['describedBy']()).toBeNull();
  });

  it('links error id when touched with required validation error', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.detectChanges();

    const componentInstance = localFixture.debugElement.children[0].children[0].componentInstance as Select;
    componentInstance.touched.set(true);
    localFixture.detectChanges();

    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });

  it('keeps the option typed value when selection changes', () => {
    const numberFixture = TestBed.createComponent(NumberHostComponent);
    numberFixture.detectChanges();

    const component = numberFixture.debugElement.children[0].children[0].componentInstance as Select;
    const value = component.options()[1]?.value;

    component['onChangeSelection']({
      target: { value: String(value) },
    } as unknown as Event);
    numberFixture.detectChanges();

    expect(numberFixture.componentInstance.model()).toBe(2);
    expect(typeof numberFixture.componentInstance.model()).toBe('number');
  });

  it('matches values after normalization and marks the same value as selected', () => {
    const whitespaceFixture = TestBed.createComponent(WhitespaceHostComponent);
    whitespaceFixture.detectChanges();

    const component = whitespaceFixture.debugElement.children[0].children[0].componentInstance as Select;
    const selectElement = whitespaceFixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const firstOption = selectElement.options[0] as HTMLOptionElement;
    const secondOption = selectElement.options[1] as HTMLOptionElement;

    expect(component['isSelected'](component.options()[0].value)).toBe(true);
    expect(component['normalizeValue'](component.options()[0].value)).toBe('Alpha');
    expect(component['normalizeValue'](component.options()[0].value)).toBe(selectElement.value);
    expect(firstOption.selected).toBe(true);
    expect(secondOption.selected).toBe(false);
  });

  it('stores the original option value when a normalized event value matches an option', () => {
    const whitespaceFixture = TestBed.createComponent(WhitespaceHostComponent);
    whitespaceFixture.detectChanges();

    const component = whitespaceFixture.debugElement.children[0].children[0].componentInstance as Select;
    const secondOptionValue = component.options()[1]!.value;

    component['onChangeSelection']({
      target: { value: component['normalizeValue'](secondOptionValue) },
    } as unknown as Event);
    whitespaceFixture.detectChanges();

    expect(whitespaceFixture.componentInstance.model()).toBe(secondOptionValue);
  });

  it('falls back to raw selected value if no matching option value is found', () => {
    const whitespaceFixture = TestBed.createComponent(WhitespaceHostComponent);
    whitespaceFixture.detectChanges();

    const component = whitespaceFixture.debugElement.children[0].children[0].componentInstance as Select;

    component['onChangeSelection']({
      target: { value: 'Missing' },
    } as unknown as Event);
    whitespaceFixture.detectChanges();

    expect(whitespaceFixture.componentInstance.model()).toBe('Missing');
  });

  it('renders label icon with accessible hint attributes', () => {
    const iconElement = fixture.nativeElement.querySelector('label [role="img"]') as HTMLElement | null;

    expect(iconElement).not.toBeNull();
    expect(iconElement.textContent?.trim()).toBe('info');
    expect(iconElement.getAttribute('title')).toBe('Select help');
    expect(iconElement.getAttribute('aria-label')).toBe('Select help');
  });
});
