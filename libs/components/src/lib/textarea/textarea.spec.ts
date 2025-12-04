import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
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
  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates control on input and adjusts height when autoHeight is true', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const setStyleSpy = jest.spyOn((component as any).renderer, 'setStyle');

    jest.runOnlyPendingTimers();

    const textareaElement = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textareaElement.value = 'hello';
    textareaElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('hello');
    expect(setStyleSpy).toHaveBeenCalledWith(expect.anything(), 'height', expect.stringContaining('px'));
  });

  it('calls onTouched on blur', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const touchedSpy = jest.fn();
    component.registerOnTouched(touchedSpy);

    const textareaElement = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textareaElement.dispatchEvent(new Event('blur'));

    expect(touchedSpy).toHaveBeenCalled();
  });

  it('disables textarea and triggers onTouched on blur with errors', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.control.setValidators(() => ({ required: true }));
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const textareaElement = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    component.setDisabledState(true);
    fixture.detectChanges();

    textareaElement.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(textareaElement.disabled).toBe(true);
    const describedBy = textareaElement.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('-error');
  });

  it('does not set describedBy when no hint or errors present', () => {
    const fixture = TestBed.createComponent(NoHintHostComponent);
    fixture.componentInstance.control.setErrors(null);
    fixture.componentInstance.control.markAsPristine();
    fixture.componentInstance.control.markAsUntouched();
    fixture.detectChanges();

    const textareaElement = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textareaElement.getAttribute('aria-describedby')).toBeNull();
  });
});
