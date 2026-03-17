import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ImageIcon } from './image-icon';

@Component({
  imports: [ImageIcon],
  template: `<libc-image-icon imageUrl="https://example.com/icon.png" ariaLabel="Example icon" />`,
})
class HostComponent {}

describe('ImageIcon component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders a span with the image url as a CSS variable and correct aria-label', () => {
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span).toBeTruthy();
    expect(span.getAttribute('aria-label')).toBe('Example icon');
    expect(span.style.getPropertyValue('--image-url')).toContain('https://example.com/icon.png');
  });
});
