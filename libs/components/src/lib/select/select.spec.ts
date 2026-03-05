import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { Select } from './select';

@Component({
  imports: [FormField, Select],
  template: `<libc-select [formField]="field" [options]="options" label="Choose" hint="Pick one"></libc-select>`,
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

describe('Select component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent, NoHintHostComponent],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders options and updates the field value on change', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    const options = component.options().map((option) => option.value);

    expect(options).toEqual(['1', '2']);

    component['onChangeSelection']({
      target: { value: '2' },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fixture.componentInstance.model()).toBe('2');
  });

  it('connects hint id to describedBy', () => {
    const component = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;

    expect(component['describedBy']()).toBe(component['hintId']());
  });

  it('marks the field as touched when blurred', () => {
    const componentInstance = fixture.debugElement.children[0].children[0].componentInstance as Select<string>;

    componentInstance['onBlur']();

    expect(componentInstance.touched()).toBe(true);
  });

  it('does not set describedBy when no hint or errors present', () => {
    const noHintFixture = TestBed.createComponent(NoHintHostComponent);
    noHintFixture.detectChanges();

    const component = noHintFixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    expect(component['describedBy']()).toBeNull();
  });

  it('links error id when touched with required validation error', () => {
    const localFixture = TestBed.createComponent(HostComponent);
    localFixture.detectChanges();

    const componentInstance = localFixture.debugElement.children[0].children[0].componentInstance as Select<string>;
    componentInstance.touched.set(true);
    localFixture.detectChanges();

    const describedBy = componentInstance['describedBy']() ?? '';
    expect(describedBy).toContain('-hint');
    expect(describedBy).toContain('-error');
  });
});
