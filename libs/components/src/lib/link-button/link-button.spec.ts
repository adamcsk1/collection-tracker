import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LinkButton } from './link-button';

@Component({
  imports: [LinkButton],
  template: `
    <libc-link-button [href]="href" [icon]="icon" [label]="label" [external]="external" [dataTestId]="dataTestId" />
  `,
})
class HostComponent {
  public href = '/home';
  public icon = 'home';
  public label = 'Home';
  public external = false;
  public dataTestId = '';
}

describe('LinkButton component', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.href = '/home';
    fixture.componentInstance.icon = 'home';
    fixture.componentInstance.label = 'Home';
    fixture.componentInstance.external = false;
    fixture.componentInstance.dataTestId = '';
  });

  it('renders the anchor with correct href, icon, and label', () => {
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor).toBeTruthy();
    expect(anchor.getAttribute('href')).toBe('/home');
    expect(anchor.textContent).toContain('home');
    expect(anchor.textContent).toContain('Home');
  });

  it('sets data-test-id attribute when provided', () => {
    fixture.componentInstance.dataTestId = 'nav-home';
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('data-test-id')).toBe('nav-home');
  });

  it('does not set data-test-id attribute when empty', () => {
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.hasAttribute('data-test-id')).toBe(false);
  });

  it('adds target and rel attributes for external links', () => {
    fixture.componentInstance.external = true;
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not add target or rel attributes for internal links', () => {
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.hasAttribute('rel')).toBe(false);
  });

  it('shows the external icon for external links', () => {
    fixture.componentInstance.external = true;
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const externalIcon = anchor.querySelector('.link-button-external');
    expect(externalIcon).toBeTruthy();
    expect(externalIcon?.textContent?.trim()).toBe('open_in_new');
  });

  it('does not show the external icon for internal links', () => {
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const externalIcon = anchor.querySelector('.link-button-external');
    expect(externalIcon).toBeNull();
  });
});
