import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Textarea } from './textarea';

@Component({
  imports: [FormField, Textarea],
  template: `
    <div style="height: 120px;">
      <libc-textarea [formField]="field" label="Bio" hint="Hint" [autoHeight]="autoHeight"></libc-textarea>
    </div>
  `,
})
class HostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model, (path) => required(path));
  public autoHeight = true;
}

@Component({
  imports: [FormField, Textarea],
  template: `<libc-textarea [formField]="field" label="Choose"></libc-textarea>`,
})
class NoHintHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
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

  it('updates field value on input and adjusts height when autoHeight is true', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    const setStyleSpy = vi.spyOn(component['renderer'], 'setStyle');

    vi.runOnlyPendingTimers();

    component['onInput']({
      target: { value: 'hello' },
    } as unknown as Event);
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    expect(fixture.componentInstance.model()).toBe('hello');
    expect(setStyleSpy).toHaveBeenCalledWith(expect.anything(), 'height', expect.stringContaining('px'));
  });

  it('marks field as touched on blur', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;

    component['onBlur']();

    expect(component.touched()).toBe(true);
  });

  it('shows error id when touched with required validation error', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.detectChanges();

    const component = localFixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    component.touched.set(true);
    localFixture.detectChanges();

    const describedBy = component['describedBy']() ?? '';
    expect(describedBy).toContain('-error');
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Textarea<string>;
    expect(component['describedBy']()).toBeNull();
  });
});
