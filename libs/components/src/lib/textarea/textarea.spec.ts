import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Textarea } from './textarea';

@Component({
  imports: [ReactiveFormsModule, Textarea],
  template: `
    <div style="height: 120px;">
      <libc-textarea [formControl]="control" label="Bio" hint="Hint" [autoHeight]="autoHeight"></libc-textarea>
    </div>
  `,
})
class HostComponent {
  public control = new FormControl('');
  public autoHeight = true;
}

@Component({
  imports: [ReactiveFormsModule, Textarea],
  template: `<libc-textarea [formControl]="control" label="Choose"></libc-textarea>`,
})
class NoHintHostComponent {
  public control = new FormControl('');
  public autoHeight = true;
}

describe('Textarea component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates control on input and adjusts height when autoHeight is true', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const setStyleSpy = vi.spyOn(component['renderer'], 'setStyle');

    vi.runOnlyPendingTimers();

    component['onInput']({
      target: { value: 'hello' },
    } as unknown as Event);
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    expect(fixture.componentInstance.control.value).toBe('hello');
    expect(setStyleSpy).toHaveBeenCalledWith(expect.anything(), 'height', expect.stringContaining('px'));
  });

  it('calls onTouched on blur', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const touchedSpy = vi.fn();
    component.registerOnTouched(touchedSpy);

    component['onBlur']();

    expect(touchedSpy).toHaveBeenCalled();
  });

  it('disables textarea and triggers onTouched on blur with errors', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.componentInstance.control.setValidators(() => ({ required: true }));
    localFixture.componentInstance.control.markAsTouched();
    localFixture.componentInstance.control.updateValueAndValidity();
    localFixture.detectChanges();

    const component = localFixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    component.setDisabledState(true);
    localFixture.detectChanges();

    component['onBlur']();
    localFixture.detectChanges();

    expect(component['isDisabled']()).toBe(true);
    const describedBy = component['describedBy']() ?? '';
    expect(describedBy).toContain('-error');
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.componentInstance.control.setErrors(null);
    noHintFixture.componentInstance.control.markAsPristine();
    noHintFixture.componentInstance.control.markAsUntouched();
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    expect(component['describedBy']()).toBeNull();
  });
});
