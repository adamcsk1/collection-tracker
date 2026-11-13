import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ListItemCard } from './list-item-card';

describe('ListItemCard', () => {
  it('keeps badge and image actions separate and keyboard accessible', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    fixture.componentRef.setInput('title', 'Example');
    fixture.componentRef.setInput('imageBadgeText', 'Tag');
    const open = vi.fn();
    const badgeClick = vi.fn();
    fixture.componentInstance.open.subscribe(open);
    fixture.componentInstance.imageBadgeClick.subscribe(badgeClick);
    await fixture.whenStable();

    const image: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="list-item-image"]');
    const badge: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="list-item-image-badge"]');
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-title"]').tagName).toBe('H2');
    expect(image.getAttribute('role')).toBe('button');
    expect(image.contains(badge)).toBe(false);
    expect(badge.tagName).toBe('BUTTON');
    badge.click();
    expect(badgeClick).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    image.click();
    image.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    image.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('disables the badge when filtering is unavailable', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    fixture.componentRef.setInput('title', 'Example');
    fixture.componentRef.setInput('imageBadgeText', 'Tag');
    fixture.componentRef.setInput('imageBadgeDisabled', true);
    const badgeClick = vi.fn();
    fixture.componentInstance.imageBadgeClick.subscribe(badgeClick);
    await fixture.whenStable();

    const badge = fixture.nativeElement.querySelector('[data-test-id="list-item-image-badge"]') as HTMLButtonElement;
    expect(badge.disabled).toBe(true);
    badge.click();
    expect(badgeClick).not.toHaveBeenCalled();
  });

  it('does not expose an image button when noninteractive and names status icons', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    fixture.componentRef.setInput('title', 'Example');
    fixture.componentRef.setInput('interactive', false);
    fixture.componentRef.setInput('favorite', true);
    fixture.componentRef.setInput('favoriteLabel', 'Favorite');
    fixture.componentRef.setInput('shared', true);
    fixture.componentRef.setInput('sharedLabel', 'Shared');
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);
    await fixture.whenStable();

    const image: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="list-item-image"]');
    expect(image.hasAttribute('role')).toBe(false);
    expect(image.hasAttribute('tabindex')).toBe(false);
    image.click();
    expect(open).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-favorite"]').getAttribute('aria-label')).toBe(
      'Favorite'
    );
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-shared"]').getAttribute('aria-label')).toBe(
      'Shared'
    );
  });
});
