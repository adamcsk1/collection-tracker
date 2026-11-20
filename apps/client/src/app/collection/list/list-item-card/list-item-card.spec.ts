import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ListItemCard } from './list-item-card';

describe('ListItemCard', () => {
  it('names the shared owner and renders an avatar instead of a generic share icon', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    fixture.componentRef.setInput('title', 'Example');
    fixture.componentRef.setInput('shared', true);
    fixture.componentRef.setInput('sharedLabel', 'Shared');
    fixture.componentRef.setInput('owner', {
      ownerUserShareCode: 'owner',
      ownerUsername: 'username',
      ownerDisplayName: 'Owner name',
      ownerAvatarRevision: null,
      grants: [],
    });
    await fixture.whenStable();
    const shared: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="list-item-shared"]');
    expect(shared.getAttribute('aria-label')).toBe('Shared: Owner name');
    expect(shared.querySelector('[data-test-id="avatar-fallback"]')).not.toBeNull();
    expect(shared.querySelector('.material-icons')).toBeNull();
    fixture.componentRef.setInput('shared', false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-shared"]')).toBeNull();
  });
  it('keeps long titles readable by assistive technology and opens from the title button', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    const title = 'Batman: The Animated Series with a long title';
    fixture.componentRef.setInput('title', title);
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('[data-test-id="list-item-title-button"]') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe(title);
    expect(button.closest('h2')?.title).toBe(title);
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(open).toHaveBeenCalledOnce();
  });
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
    expect(image.tabIndex).toBe(-1);
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-title-button"]').tabIndex).toBe(0);
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

  it('shows fallback artwork for missing or failed images and tries a changed URL', async () => {
    const fixture = TestBed.createComponent(ListItemCard);
    fixture.componentRef.setInput('title', 'Example');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-image-fallback"]')).not.toBeNull();
    fixture.componentRef.setInput('imageUrl', '/broken.jpg');
    await fixture.whenStable();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="list-item-image-fallback"]')).not.toBeNull();
    fixture.componentRef.setInput('imageUrl', '/new.jpg');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/new.jpg');
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
