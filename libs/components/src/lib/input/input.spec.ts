import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { Input } from './input';

@Component({
  imports: [FormField, Input],
  template: `<libc-input
    [formField]="field"
    label="Name"
    [labelIcon]="'info'"
    [labelIconHint]="'Input help'"
    hint="Helpful"
    [showReset]="true"
  ></libc-input>`,
})
class HostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model, (path) => required(path));
}

@Component({
  imports: [FormField, Input],
  template: `<libc-input [formField]="field" label="Name"></libc-input>`,
})
class NoHintHostComponent {
  public readonly model = signal('');
  public readonly field = form(this.model);
}

describe('Input component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('syncs value with the form field and resets via button', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    component['onInput']({
      target: { value: 'abc' },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('abc');
    expect(component['hasValue']()).toBe(true);

    component['onReset']();
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('');
    expect(component['value']()).toBe('');
  });

  it('provides hint id in describedBy when hint is set', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('marks the field as touched when blurred', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Input<string>;

    component['onBlur']();

    expect(component.touched()).toBe(true);
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Input<string>;
    expect(component['describedBy']()).toBeNull();
  });

  it('exposes error id when touched with required validation error', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.detectChanges();

    const componentInstance = localFixture.debugElement.children[0].children[0].componentInstance as Input<string>;
    componentInstance.touched.set(true);
    localFixture.detectChanges();

    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });

  it('renders label icon with accessible hint attributes', () => {
    const iconElement = fixture.nativeElement.querySelector('label [role="img"]') as HTMLElement | null;

    expect(iconElement).not.toBeNull();
    expect(iconElement.textContent?.trim()).toBe('info');
    expect(iconElement.getAttribute('title')).toBe('Input help');
    expect(iconElement.getAttribute('aria-label')).toBe('Input help');
  });
});
