import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialogTranslations } from '../item-form/item-form-model';
import { ItemDialogActions } from './item-dialog-actions';

const translations: ItemDialogTranslations = {
  actors: signal('Actors'),
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
  removeFavorite: signal('Remove favorite'),
  removeFromTracking: signal('Remove from Tracking'),
  markAsFavorite: signal('Mark as favorite'),
  fallbackNotAvailable: signal('N/A'),
  fallbackUnknownYear: signal('Unknown year'),
  genre: signal('Genre'),
  subjects: signal('Subjects'),
  description: signal('Description'),
  isbn: signal('ISBN'),
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
    fixture.componentRef.setInput('watchlist', overrides['watchlist'] ?? false);
    fixture.componentRef.setInput('movie', overrides['movie'] ?? true);
    fixture.componentRef.setInput('series', overrides['series'] ?? false);
    fixture.componentRef.setInput('finished', overrides['finished'] ?? false);
    fixture.componentRef.setInput('favorite', overrides['favorite'] ?? false);
    fixture.componentRef.setInput('inTracking', overrides['inTracking'] ?? false);
    fixture.componentRef.setInput('inFinished', overrides['inFinished'] ?? false);
    fixture.componentRef.setInput('finishedEnabled', overrides['finishedEnabled'] ?? true);
    fixture.componentRef.setInput('trackingEnabled', overrides['trackingEnabled'] ?? true);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ItemDialogActions] });
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

  it('renders provided edit and delete labels', () => {
    createComponent();

    const editButton = getButton('item-dialog-edit');
    const deleteButton = getButton('item-dialog-delete');

    expect(editButton.textContent).toContain('Edit');
    expect(editButton.classList.contains('button-icon')).toBe(true);
    expect(editButton.getAttribute('aria-label')).toBe('Edit');
    expect(editButton.getAttribute('title')).toBe('Edit');
    expect(editButton.querySelector('.button-reveal-label-text')?.textContent).toContain('Edit');
    expect(deleteButton.textContent).toContain('Delete');
    expect(deleteButton.classList.contains('button-icon')).toBe(true);
    expect(deleteButton.getAttribute('aria-label')).toBe('Delete');
    expect(deleteButton.getAttribute('title')).toBe('Delete');
    expect(deleteButton.querySelector('.button-reveal-label-text')?.textContent).toContain('Delete');
  });

  it('renders series tracker actions when update permission is available', () => {
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
    createComponent({ libraryItem: false, watchlist: true, movie: true });
    const moveToFinished = vi.fn();
    fixture.componentInstance.moveToFinished.subscribe(moveToFinished);
    getButton('item-dialog-move-finished').click();
    expect(queryButton('item-dialog-mark-finished')).toBeNull();
    expect(moveToFinished).toHaveBeenCalled();

    createComponent({ libraryItem: false, watchlist: true, movie: false, series: true });
    const moveToTracking = vi.fn();
    fixture.componentInstance.moveToTracking.subscribe(moveToTracking);
    getButton('item-dialog-move-tracking').click();
    expect(queryButton('item-dialog-mark-finished')).toBeNull();
    expect(queryButton('item-dialog-copy-tracking')).toBeNull();
    expect(moveToTracking).toHaveBeenCalled();
  });

  it('hides move to finished when movie is already tracked', () => {
    createComponent({ libraryItem: false, watchlist: true, movie: true, inFinished: true });
    expect(queryButton('item-dialog-move-finished')).toBeNull();
  });

  it('hides move to tracking when series is already tracked', () => {
    createComponent({ libraryItem: false, watchlist: true, movie: false, series: true, inTracking: true });
    expect(queryButton('item-dialog-move-tracking')).toBeNull();
  });

  it('hides finished actions when the feature is disabled', () => {
    createComponent({ finishedEnabled: false, libraryItem: true, movie: true });
    expect(queryButton('item-dialog-mark-finished')).toBeNull();

    createComponent({ finishedEnabled: false, libraryItem: false, watchlist: true, movie: true });
    expect(queryButton('item-dialog-move-finished')).toBeNull();
  });

  it('hides tracking actions when the feature is disabled', () => {
    createComponent({ trackingEnabled: false, libraryItem: true, movie: false, series: true });
    expect(queryButton('item-dialog-copy-tracking')).toBeNull();

    createComponent({ trackingEnabled: false, libraryItem: false, watchlist: true, movie: false, series: true });
    expect(queryButton('item-dialog-move-tracking')).toBeNull();
  });

  it('hides actions while editing', () => {
    createComponent({ editMode: true });

    expect(queryButton('item-dialog-delete')).toBeNull();
  });

  const getButton = (testId: string): HTMLButtonElement => {
    const button = queryButton(testId);
    if (!button) throw new Error(`Button ${testId} not found`);
    return button;
  };

  const queryButton = (testId: string): HTMLButtonElement | null => {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-test-id="${testId}"]`);
  };
});
