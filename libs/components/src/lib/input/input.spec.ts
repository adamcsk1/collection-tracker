import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from './input';

@Component({
  imports: [ReactiveFormsModule, Input],
  template: `<libc-input [formControl]="control" label="Name" hint="Helpful" [showReset]="true"></libc-input>`,
})
class HostComponent {
  public control = new FormControl('');
}

@Component({
  imports: [ReactiveFormsModule, Input],
  template: `<libc-input [formControl]="control" label="Name"></libc-input>`,
})
class NoHintHostComponent {
  public control = new FormControl('');
}

describe('Input component', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
  });

  it('syncs value with the form control and resets via button', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    component['onInput']({
      target: { value: 'abc' },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('abc');
    expect(component['hasValue']()).toBe(true);

    component['onReset']();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('');
    expect(component['value']()).toBe('');
  });

  it('provides hint id in describedBy when hint is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('invokes onTouched when blurred', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;
    const touchedSpy = vi.fn();
    component.registerOnTouched(touchedSpy);

    component['onBlur']();

    expect(touchedSpy).toHaveBeenCalled();
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setValidators(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;
    expect(component['describedBy']()).toBeNull();
  });

  it('disables the input and exposes error id when control is touched with errors', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.control.setValidators(Validators.required);
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();

    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    componentInstance.setDisabledState(true);
    fixture.detectChanges();

    expect(componentInstance['isDisabled']()).toBe(true);
    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });
});
