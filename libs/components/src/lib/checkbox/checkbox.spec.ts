import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';

@Component({
  selector: 'libc-checkbox-test-host',
  imports: [FormField, Checkbox],
  template: `<libc-checkbox
    [formField]="field"
    label="Watched"
    hint="Hint"
    [mandatory]="true"
    [indeterminate]="indeterminate()"
    [disabled]="disabled()"
    (valueChange)="emittedValue.set($event)"
  ></libc-checkbox>`,
})
class HostComponent {
  public readonly model = signal(false);
  public readonly field = form(this.model, (path) => required(path));
  public readonly indeterminate = signal(true);
  public readonly disabled = signal(false);
  public readonly emittedValue = signal<boolean | null>(null);
}

@Component({
  selector: 'libc-checkbox-no-hint-test-host',
  imports: [FormField, Checkbox],
  template: `<libc-checkbox [formField]="field" label="Watched"></libc-checkbox>`,
})
class NoHintHostComponent {
  public readonly model = signal(false);
  public readonly field = form(this.model);
}

describe('Checkbox component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('updates and emits value on change', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Checkbox;

    component['onChange']({ target: { checked: true } } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe(true);
    expect(component.value()).toBe(true);
    expect(fixture.componentInstance.emittedValue()).toBe(true);
  });

  it('binds initial and updated indeterminate state to the native checkbox', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.indeterminate).toBe(true);
    expect(input.checked).toBe(false);
    expect(input.getAttribute('aria-checked')).toBe('mixed');

    fixture.componentInstance.indeterminate.set(false);
    fixture.detectChanges();

    expect(input.indeterminate).toBe(false);
    expect(input.checked).toBe(false);
    expect(input.getAttribute('aria-checked')).toBe('false');
  });

  it('binds disabled state to the native checkbox', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.disabled).toBe(false);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(input.disabled).toBe(true);
  });

  it('marks the field as touched on blur', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Checkbox;

    component['onBlur']();

    expect(component.touched()).toBe(true);
  });

  it('connects hint id to describedBy', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Checkbox;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Checkbox;
    expect(component['describedBy']()).toBeNull();
  });

  it('links error id when touched with required validation error', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.detectChanges();

    const componentInstance = localFixture.debugElement.children[0].children[0].componentInstance as Checkbox;
    componentInstance.touched.set(true);
    localFixture.detectChanges();

    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });
});
