import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from './select';

@Component({
  imports: [ReactiveFormsModule, Select],
  template: `<libc-select [formControl]="control" [options]="options" label="Choose" hint="Pick one"></libc-select>`,
})
class HostComponent {
  public control = new FormControl('', { validators: Validators.required });
  public options = [
    { text: 'One', value: '1' },
    { text: 'Two', value: '2' },
  ];
}

@Component({
  imports: [ReactiveFormsModule, Select],
  template: `<libc-select [formControl]="control" [options]="options" label="Choose"></libc-select>`,
})
class NoHintHostComponent {
  public control = new FormControl('', { validators: Validators.required });
  public options = [
    { text: 'One', value: '1' },
    { text: 'Two', value: '2' },
  ];
}

describe('Select component', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
  });

  it('renders options and updates the control on change', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    const options = component.options().map((option) => option.value);

    expect(options).toEqual(['1', '2']);

    component['onChangeSelection']({
      target: { value: '2' },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('2');
  });

  it('connects hint id to describedBy', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('calls onTouched when blurred', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    const touchedSpy = vi.fn();
    componentInstance.registerOnTouched(touchedSpy);

    componentInstance['onBlur']();

    expect(touchedSpy).toHaveBeenCalled();
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setErrors(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    expect(component['describedBy']()).toBeNull();
  });

  it('disables the control via setDisabledState and links error id', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.setErrors({ required: true });
    fixture.detectChanges();

    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;

    componentInstance.setDisabledState(true);
    fixture.detectChanges();

    expect(componentInstance['isDisabled']()).toBe(true);
    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });
});
