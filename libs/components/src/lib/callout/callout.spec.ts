import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Callout } from './callout';

@Component({
  selector: 'libc-test-callout-host',
  imports: [Callout],
  template: `<libc-callout data-test-id="test-callout" icon="info">Projected message</libc-callout>`,
})
class HostComponent {}

describe('Callout', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders projected content as a note', () => {
    const host = fixture.nativeElement.querySelector('[data-test-id="test-callout"]');
    const aside = host.querySelector('aside');

    expect(aside.textContent).toContain('Projected message');
    expect(aside.getAttribute('role')).toBe('note');
  });

  it('renders a decorative Material icon', () => {
    const icon = fixture.nativeElement.querySelector('.material-icons');

    expect(icon.textContent.trim()).toBe('info');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });
});
