import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';

@Component({
  imports: [FormField, Checkbox],
  template: `<libc-checkbox [formField]="field" label="Watched" hint="Hint" [mandatory]="true"></libc-checkbox>`,
})
class HostComponent {
  public readonly model = signal(false);
  public readonly field = form(this.model, (path) => required(path));
}

@Component({
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

  it('updates value on change', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Checkbox;

    component['onChange']({ target: { checked: true } } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe(true);
    expect(component.value()).toBe(true);
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
