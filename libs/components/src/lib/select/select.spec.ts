import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
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

    const selectElement = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const options = Array.from(selectElement.querySelectorAll('option')).map((option) => option.value);

    expect(options).toEqual(['1', '2']);

    selectElement.value = '2';
    selectElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('2');
  });

  it('connects hint id to describedBy', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const selectElement = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const hintElement = fixture.nativeElement.querySelector('small') as HTMLElement;

    expect(selectElement.getAttribute('aria-describedby')).toBe(hintElement.id);
  });

  it('calls onTouched when blurred', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    const touchedSpy = jest.fn();
    componentInstance.registerOnTouched(touchedSpy);

    const selectElement = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    selectElement.dispatchEvent(new Event('blur'));

    expect(touchedSpy).toHaveBeenCalled();
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setErrors(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const selectElement = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(selectElement.getAttribute('aria-describedby')).toBeNull();
  });

  it('disables the control via setDisabledState and links error id', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.setErrors({ required: true });
    fixture.detectChanges();

    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    const selectElement = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    componentInstance.setDisabledState(true);
    fixture.detectChanges();

    expect(selectElement.disabled).toBe(true);
    const describedBy = selectElement.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });
});
