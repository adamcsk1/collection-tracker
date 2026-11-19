import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialogTranslations } from '../item-form/item-form-model';
import { ItemDialogActions } from './item-dialog-actions';

const translations: ItemDialogTranslations = {
  actors: signal('Actors'),
  artists: signal('Artists'),
  authors: signal('Authors'),
  altPoster: signal('Poster image'),
  manageCompletedEpisodes: signal('Manage watched episodes'),
  manageSeriesMetadata: signal('Manage series metadata'),
  markAsUnfinished: signal('Mark as unwatched'),
  markAsFinished: signal('Mark as watched'),
  copyToTracking: signal('Add to Tracking'),
  moveToFinished: signal('Move to Watched'),
  moveToTracking: signal('Move to Tracking'),
  openInTracking: signal('Open in Tracking'),
  opensInNewTab: signal('opens in a new tab'),
  removeFavorite: signal('Remove favorite'),
  removeFromTracking: signal('Remove from Tracking'),
  share: signal('Share item'),
  markAsFavorite: signal('Mark as favorite'),
  fallbackNotAvailable: signal('N/A'),
  fallbackUnknownYear: signal('Unknown year'),
  genre: signal('Genre'),
  subjects: signal('Subjects'),
  description: signal('Description'),
  isbn: signal('ISBN'),
  mbid: signal('MBID'),
  labelMetacriticRate: signal('Metacritic'),
  labelRottenTomatoesRate: signal('Rotten Tomatoes'),
  labelUserRate: signal('User rate'),
  linkWebSearch: signal('Web search'),
  linkYouTubeTrailer: signal('Trailer'),
  links: signal('Links'),
  plot: signal('Plot'),
  ratings: signal('Ratings'),
  tags: signal('Tags'),
  watchedUpTo: signal('Watched up to'),
  readingProgress: signal('Reading progress'),
  pagesRead: signal('Pages read'),
  totalPages: signal('Total pages'),
  edit: signal('Edit'),
  delete: signal('Delete'),
};

describe('ItemDialogActions', () => {
  let fixture: ComponentFixture<ItemDialogActions>;
  let reducedMotion: boolean;

  const createComponent = (overrides: Partial<Record<string, unknown>> = {}) => {
    fixture = TestBed.createComponent(ItemDialogActions);
    fixture.componentRef.setInput('translations', translations);
    fixture.componentRef.setInput('editMode', overrides['editMode'] ?? false);
    fixture.componentRef.setInput('permissionUpdate', overrides['permissionUpdate'] ?? true);
    fixture.componentRef.setInput('permissionWatch', overrides['permissionWatch'] ?? true);
    fixture.componentRef.setInput('permissionDelete', overrides['permissionDelete'] ?? true);
    fixture.componentRef.setInput('tracking', overrides['tracking'] ?? false);
    fixture.componentRef.setInput('libraryItem', overrides['libraryItem'] ?? true);
    fixture.componentRef.setInput('ownershipItem', overrides['ownershipItem'] ?? overrides['libraryItem'] ?? true);
    fixture.componentRef.setInput('upNext', overrides['upNext'] ?? false);
    fixture.componentRef.setInput('movie', overrides['movie'] ?? true);
    fixture.componentRef.setInput('series', overrides['series'] ?? false);
    fixture.componentRef.setInput('book', overrides['book'] ?? false);
    fixture.componentRef.setInput('album', overrides['album'] ?? false);
    fixture.componentRef.setInput('finished', overrides['finished'] ?? false);
    fixture.componentRef.setInput('favorite', overrides['favorite'] ?? false);
    fixture.componentRef.setInput('inTracking', overrides['inTracking'] ?? false);
    fixture.componentRef.setInput('inFinished', overrides['inFinished'] ?? false);
    fixture.componentRef.setInput('finishedEnabled', overrides['finishedEnabled'] ?? true);
    fixture.componentRef.setInput('trackingEnabled', overrides['trackingEnabled'] ?? true);
    fixture.componentRef.setInput('ownItem', overrides['ownItem'] ?? true);
    fixture.detectChanges();
    const dialog = getActionsDialog();
    if (dialog) {
      dialog.showModal = vi.fn(() => {
        dialog.open = true;
      });
      dialog.close = vi.fn(() => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      });
    }
  };

  beforeEach(() => {
    reducedMotion = true;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: reducedMotion, media: query }))
    );
    TestBed.configureTestingModule({
      imports: [ItemDialogActions],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits edit and delete actions when buttons are clicked', () => {
    createComponent();
    const edit = vi.fn();
    const deleteItem = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.delete.subscribe(deleteItem);

    getButton('item-dialog-edit').click();
    getButton('item-dialog-delete').click();

    expect(edit).toHaveBeenCalled();
    expect(deleteItem).toHaveBeenCalled();
  });

  it('preserves the focused completion and favorite controls when state changes', async () => {
    createComponent();
    const completion = getButton('item-dialog-mark-finished');
    completion.focus();
    fixture.componentRef.setInput('finished', true);
    await fixture.whenStable();
    expect(getButton('item-dialog-mark-unfinished')).toBe(completion);
    expect(document.activeElement).toBe(completion);
    const favorite = getButton('item-dialog-mark-favorite');
    favorite.focus();
    fixture.componentRef.setInput('favorite', true);
    await fixture.whenStable();
    expect(getButton('item-dialog-remove-favorite')).toBe(favorite);
    expect(document.activeElement).toBe(favorite);
  });

  it('keeps completion and favorite outside the closed secondary dialog with pressed state', async () => {
    createComponent();

    expect(getActionsDialog()?.open).toBe(false);
    expect(getActionsDialog()?.hidden).toBe(true);
    expect(getButton('item-dialog-edit').closest('dialog')).toBe(getActionsDialog());
    expect(getButton('item-dialog-share').closest('dialog')).toBe(getActionsDialog());
    expect(getButton('item-dialog-delete').closest('dialog')).toBe(getActionsDialog());
    expect(getButton('item-dialog-mark-finished').closest('dialog')).toBeNull();
    expect(getButton('item-dialog-mark-favorite').closest('dialog')).toBeNull();
    expect(getButton('item-dialog-mark-finished').getAttribute('aria-pressed')).toBe('false');
    expect(getButton('item-dialog-mark-favorite').getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('finished', true);
    fixture.componentRef.setInput('favorite', true);
    await fixture.whenStable();

    expect(getButton('item-dialog-mark-unfinished').getAttribute('aria-pressed')).toBe('true');
    expect(getButton('item-dialog-remove-favorite').getAttribute('aria-pressed')).toBe('true');
  });

  it('opens More and closes it before emitting a secondary action', async () => {
    createComponent();
    const edit = vi.fn(() => expect(getActionsDialog()?.open).toBe(false));
    fixture.componentInstance.edit.subscribe(edit);

    getButton('item-dialog-more').click();
    await fixture.whenStable();
    expect(getActionsDialog()?.open).toBe(true);
    expect(getActionsDialog()?.hidden).toBe(false);
    expect(getButton('item-dialog-more').getAttribute('aria-expanded')).toBe('true');
    expect(getActionsDialog()?.getAttribute('aria-label')).toBe('ItemAction.Title');

    getButton('item-dialog-edit').click();
    await fixture.whenStable();

    expect(edit).toHaveBeenCalledOnce();
    expect(getActionsDialog()?.hidden).toBe(true);
    expect(getButton('item-dialog-more').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes More with Escape without propagating to its parent', async () => {
    createComponent();
    getButton('item-dialog-more').click();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const parentKeydown = vi.fn();
    fixture.nativeElement.addEventListener('keydown', parentKeydown);

    getButton('item-dialog-more-close').dispatchEvent(escape);
    await fixture.whenStable();

    expect(getActionsDialog()?.open).toBe(false);
    expect(escape.defaultPrevented).toBe(true);
    expect(getActionsDialog()?.hidden).toBe(true);
    expect(parentKeydown).not.toHaveBeenCalled();
    expect(getButton('item-dialog-more').getAttribute('aria-expanded')).toBe('false');
  });

  it('waits for the exit animation before closing and emitting the selected action', async () => {
    reducedMotion = false;
    createComponent();
    const dialog = getActionsDialog()!;
    const edit = vi.fn(() => {
      expect(dialog.open).toBe(false);
      expect(dialog.hidden).toBe(true);
    });
    fixture.componentInstance.edit.subscribe(edit);
    getButton('item-dialog-more').click();
    await fixture.whenStable();

    getButton('item-dialog-edit').click();

    expect(dialog.open).toBe(true);
    expect(dialog.hidden).toBe(false);
    expect(dialog.classList.contains('actions-closing')).toBe(true);
    expect(getButton('item-dialog-more').getAttribute('aria-expanded')).toBe('true');
    expect(edit).not.toHaveBeenCalled();

    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    await fixture.whenStable();

    expect(edit).toHaveBeenCalledOnce();
    expect(dialog.classList.contains('actions-closing')).toBe(false);
    expect(getButton('item-dialog-more').getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores duplicate close requests and actions while closing and allows reopening afterwards', () => {
    reducedMotion = false;
    createComponent();
    const dialog = getActionsDialog()!;
    const edit = vi.fn();
    const share = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.share.subscribe(share);
    getButton('item-dialog-more').click();
    getButton('item-dialog-edit').click();
    getButton('item-dialog-edit').click();
    getButton('item-dialog-share').click();
    getButton('item-dialog-more-close').click();
    getButton('item-dialog-more').click();

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();

    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');

    expect(dialog.close).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledOnce();
    expect(share).not.toHaveBeenCalled();

    getButton('item-dialog-more').click();
    getButton('item-dialog-share').click();
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');

    expect(dialog.showModal).toHaveBeenCalledTimes(2);
    expect(share).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledOnce();
  });

  it('ignores child, backdrop, entry and unrelated animation events while closing', () => {
    reducedMotion = false;
    createComponent();
    const dialog = getActionsDialog()!;
    const edit = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    getButton('item-dialog-more').click();
    getButton('item-dialog-edit').click();

    dispatchAnimation(getButton('item-dialog-edit'), 'animationend', 'actions-popup-leave');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave', '::backdrop');
    dispatchAnimation(dialog, 'animationcancel', 'actions-sheet-leave', '::backdrop');
    dispatchAnimation(dialog, 'animationend', 'actions-popup-enter');
    dispatchAnimation(dialog, 'animationcancel', 'actions-sheet-enter');
    dispatchAnimation(dialog, 'animationend', 'unrelated-leave');

    expect(dialog.open).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();

    dispatchAnimation(dialog, 'animationend', 'actions-popup-leave');
    expect(edit).toHaveBeenCalledOnce();
  });

  for (const animationName of [
    'actions-popup-leave',
    'actions-sheet-leave',
    '_ngcontent-test_actions-popup-leave',
    '_ngcontent-test_actions-sheet-leave',
  ]) {
    for (const eventType of ['animationend', 'animationcancel']) {
      it(`finishes closing on ${eventType} for ${animationName}`, () => {
        reducedMotion = false;
        createComponent();
        const dialog = getActionsDialog()!;
        const share = vi.fn();
        fixture.componentInstance.share.subscribe(share);
        getButton('item-dialog-more').click();
        dispatchAnimation(dialog, eventType, animationName);
        expect(dialog.open).toBe(true);
        getButton('item-dialog-share').click();
        expect(share).not.toHaveBeenCalled();

        dispatchAnimation(dialog, eventType, animationName);

        expect(dialog.open).toBe(false);
        expect(dialog.hidden).toBe(true);
        expect(share).toHaveBeenCalledOnce();
      });
    }
  }

  it('closes and emits immediately with reduced motion without waiting for an animation', () => {
    createComponent();
    const dialog = getActionsDialog()!;
    const edit = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    getButton('item-dialog-more').click();
    getButton('item-dialog-edit').click();

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(dialog.open).toBe(false);
    expect(dialog.hidden).toBe(true);
    expect(dialog.classList.contains('actions-closing')).toBe(false);
    expect(edit).toHaveBeenCalledOnce();
  });

  it('dismisses More with its close button and backdrop but not a click inside', () => {
    createComponent();
    const dialog = getActionsDialog()!;
    getButton('item-dialog-more').click();
    getButton('item-dialog-more-close').click();
    expect(dialog.open).toBe(false);

    getButton('item-dialog-more').click();
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 200, 200));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(dialog.open).toBe(false);
  });

  it('shows sharing for owned items and emits its action', () => {
    createComponent();
    const share = vi.fn();
    fixture.componentInstance.share.subscribe(share);

    const button = getButton('item-dialog-share');
    button.click();

    expect(button.getAttribute('aria-label')).toBe('Share item');
    expect(share).toHaveBeenCalled();
  });

  it('hides sharing for received items and while editing', () => {
    createComponent({ ownItem: false });
    expect(queryButton('item-dialog-share')).toBeNull();

    createComponent({ editMode: true });
    expect(queryButton('item-dialog-share')).toBeNull();
  });

  it('renders provided edit and delete labels', () => {
    createComponent();

    const editButton = getButton('item-dialog-edit');
    const deleteButton = getButton('item-dialog-delete');

    expect(editButton.textContent).toContain('Edit');
    expect(editButton.classList.contains('dialog-action')).toBe(true);
    expect(editButton.getAttribute('aria-label')).toBe('Edit');
    expect(editButton.getAttribute('title')).toBe('Edit');
    expect(editButton.querySelector('span')?.textContent).toContain('Edit');
    expect(deleteButton.textContent).toContain('Delete');
    expect(deleteButton.classList.contains('dialog-action')).toBe(true);
    expect(deleteButton.classList.contains('button-danger')).toBe(true);
    expect(deleteButton.getAttribute('aria-label')).toBe('Delete');
    expect(deleteButton.getAttribute('title')).toBe('Delete');
    expect(deleteButton.querySelector('span')?.textContent).toContain('Delete');
    expect(deleteButton.previousElementSibling?.getAttribute('data-test-id')).toBe('item-dialog-destructive-divider');
    expect(fixture.nativeElement.querySelector('.button-reveal-label')).toBeNull();
  });

  it('omits the destructive divider without delete permission', () => {
    createComponent({ permissionDelete: false });
    expect(queryButton('item-dialog-delete')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="item-dialog-destructive-divider"]')).toBeNull();
  });

  it('renders tracking actions when update permission is available', () => {
    createComponent({ tracking: true, libraryItem: false, movie: false, series: true });
    const manageCompletedEpisodes = vi.fn();
    fixture.componentInstance.manageCompletedEpisodes.subscribe(manageCompletedEpisodes);

    getButton('item-dialog-manage-completed-episodes').click();

    expect(getButton('item-dialog-manage-series-metadata')).toBeTruthy();
    expect(manageCompletedEpisodes).toHaveBeenCalled();
  });

  it('renders watch actions for permitted library movie items', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: true });
    const markAsFinished = vi.fn();
    fixture.componentInstance.markAsFinished.subscribe(markAsFinished);

    getButton('item-dialog-mark-finished').click();

    expect(markAsFinished).toHaveBeenCalled();
  });

  it('renders copy to tracking for permitted library series items', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: false, series: true });
    const copyToTracking = vi.fn();
    fixture.componentInstance.copyToTracking.subscribe(copyToTracking);

    getButton('item-dialog-copy-tracking').click();

    expect(copyToTracking).toHaveBeenCalled();
    expect(queryButton('item-dialog-mark-finished')).toBeNull();
  });

  it('renders completion and tracking actions for permitted music items', () => {
    createComponent({ movie: false, album: true });

    expect(getButton('item-dialog-mark-finished')).toBeTruthy();
    expect(getButton('item-dialog-copy-tracking')).toBeTruthy();
  });

  it('renders open in tracking and remove when series is already tracked', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: false, series: true, inTracking: true });
    const openInTracking = vi.fn();
    const removeFromTracking = vi.fn();
    fixture.componentInstance.openInTracking.subscribe(openInTracking);
    fixture.componentInstance.removeFromTracking.subscribe(removeFromTracking);

    getButton('item-dialog-open-in-tracking').click();
    getButton('item-dialog-remove-tracking').click();

    expect(openInTracking).toHaveBeenCalled();
    expect(removeFromTracking).toHaveBeenCalled();
    expect(queryButton('item-dialog-copy-tracking')).toBeNull();
  });

  it('renders move actions for Up Next movie and series items', () => {
    createComponent({ libraryItem: false, upNext: true, movie: true });
    const moveToFinished = vi.fn();
    fixture.componentInstance.moveToFinished.subscribe(moveToFinished);
    getButton('item-dialog-move-finished').click();
    expect(queryButton('item-dialog-mark-finished')).toBeNull();
    expect(moveToFinished).toHaveBeenCalled();

    createComponent({ libraryItem: false, upNext: true, movie: false, series: true });
    const moveToTracking = vi.fn();
    fixture.componentInstance.moveToTracking.subscribe(moveToTracking);
    getButton('item-dialog-move-tracking').click();
    expect(queryButton('item-dialog-mark-finished')).toBeNull();
    expect(queryButton('item-dialog-copy-tracking')).toBeNull();
    expect(moveToTracking).toHaveBeenCalled();
  });

  it('hides move to finished when movie is already tracked', () => {
    createComponent({ libraryItem: false, upNext: true, movie: true, inFinished: true });
    expect(queryButton('item-dialog-move-finished')).toBeNull();
  });

  it('hides move to tracking when series is already tracked', () => {
    createComponent({ libraryItem: false, upNext: true, movie: false, series: true, inTracking: true });
    expect(queryButton('item-dialog-move-tracking')).toBeNull();
  });

  it('hides finished actions when the feature is disabled', () => {
    createComponent({ finishedEnabled: false, libraryItem: true, movie: true });
    expect(queryButton('item-dialog-mark-finished')).toBeNull();

    createComponent({ finishedEnabled: false, libraryItem: false, upNext: true, movie: true });
    expect(queryButton('item-dialog-move-finished')).toBeNull();
  });

  it('hides tracking actions when the feature is disabled', () => {
    createComponent({ trackingEnabled: false, libraryItem: true, movie: false, series: true });
    expect(queryButton('item-dialog-copy-tracking')).toBeNull();

    createComponent({ trackingEnabled: false, libraryItem: false, upNext: true, movie: false, series: true });
    expect(queryButton('item-dialog-move-tracking')).toBeNull();
  });

  it('hides actions while editing', () => {
    createComponent({ editMode: true });

    expect(queryButton('item-dialog-delete')).toBeNull();
    expect(queryButton('item-dialog-more')).toBeNull();
    expect(getActionsDialog()).toBeNull();
  });

  it('omits More when no secondary actions are available', () => {
    createComponent({ permissionUpdate: false, permissionDelete: false, ownItem: false });

    expect(queryButton('item-dialog-more')).toBeNull();
    expect(getActionsDialog()).toBeNull();
    expect(getButton('item-dialog-mark-finished')).toBeTruthy();
  });

  const getButton = (testId: string): HTMLButtonElement => {
    const button = queryButton(testId);
    if (!button) throw new Error(`Button ${testId} not found`);
    return button;
  };

  const queryButton = (testId: string): HTMLButtonElement | null => {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-test-id="${testId}"]`);
  };

  const getActionsDialog = (): HTMLDialogElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="item-dialog-more-actions"]');

  const dispatchAnimation = (target: HTMLElement, eventType: string, animationName: string, pseudoElement = '') => {
    const event = new Event(eventType, { bubbles: true });
    Object.defineProperties(event, {
      animationName: { value: animationName },
      pseudoElement: { value: pseudoElement },
    });
    target.dispatchEvent(event);
  };
});
