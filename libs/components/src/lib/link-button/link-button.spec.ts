import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LinkButton } from './link-button';

@Component({
  imports: [LinkButton],
  template: `
    <libc-link-button href="/health/" icon="monitoring" label="Health" dataTestId="health-link"></libc-link-button>
  `,
})
class NavHostComponent {}

@Component({
  imports: [LinkButton],
  template: `
    <libc-link-button
      href="https://github.com"
      icon="code"
      label="GitHub"
      variant="action"
      [external]="true"
      dataTestId="github-link"
    ></libc-link-button>
  `,
})
class ActionHostComponent {}

describe('LinkButton', () => {
  it('renders nav variant with correct attributes', () => {
    TestBed.configureTestingModule({ imports: [NavHostComponent] });
    const fixture = TestBed.createComponent(NavHostComponent);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a');
    expect(anchor.getAttribute('href')).toBe('/health/');
    expect(anchor.getAttribute('data-test-id')).toBe('health-link');
    expect(anchor.classList.contains('link-button-nav')).toBe(true);
    expect(anchor.querySelector('i')?.textContent?.trim()).toBe('monitoring');
    expect(anchor.querySelector('span')?.textContent).toBe('Health');
    expect(anchor.querySelectorAll('i').length).toBe(1);
  });

  it('renders action variant with external link attributes', () => {
    TestBed.configureTestingModule({ imports: [ActionHostComponent] });
    const fixture = TestBed.createComponent(ActionHostComponent);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a');
    expect(anchor.getAttribute('href')).toBe('https://github.com');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor.classList.contains('link-button-action')).toBe(true);
    expect(anchor.querySelectorAll('i').length).toBe(2);
  });

  it('does not render target or rel for internal links', () => {
    TestBed.configureTestingModule({ imports: [NavHostComponent] });
    const fixture = TestBed.createComponent(NavHostComponent);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a');
    expect(anchor.getAttribute('target')).toBeNull();
    expect(anchor.getAttribute('rel')).toBeNull();
  });
});
