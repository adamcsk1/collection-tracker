import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialogTranslations } from '../item-form/item-form-model';
import { ItemDialogActions } from './item-dialog-actions';

const translations: ItemDialogTranslations = {
  actors: signal('Actors'),
  authors: signal('Authors'),
  altPoster: signal('Poster image'),
  manageWatchedEpisodes: signal('Manage watched episodes'),
  manageSeriesMetadata: signal('Manage series metadata'),
  markAsUnwatched: signal('Mark as unwatched'),
  markAsWatched: signal('Mark as watched'),
  copyToWatching: signal('Add to Watching'),
  moveToWatched: signal('Move to Watched'),
  moveToWatching: signal('Move to Watching'),
  openInWatching: signal('Open in Watching'),
  removeFavorite: signal('Remove favorite'),
  removeFromWatching: signal('Remove from Watching'),
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
    fixture.componentRef.setInput('watching', overrides['watching'] ?? false);
    fixture.componentRef.setInput('libraryItem', overrides['libraryItem'] ?? true);
    fixture.componentRef.setInput('watchlist', overrides['watchlist'] ?? false);
    fixture.componentRef.setInput('movie', overrides['movie'] ?? true);
    fixture.componentRef.setInput('series', overrides['series'] ?? false);
    fixture.componentRef.setInput('watched', overrides['watched'] ?? false);
    fixture.componentRef.setInput('favorite', overrides['favorite'] ?? false);
    fixture.componentRef.setInput('inWatching', overrides['inWatching'] ?? false);
    fixture.componentRef.setInput('inWatched', overrides['inWatched'] ?? false);
    fixture.componentRef.setInput('watchedEnabled', overrides['watchedEnabled'] ?? true);
    fixture.componentRef.setInput('watchingEnabled', overrides['watchingEnabled'] ?? true);
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
    createComponent({ watching: true, libraryItem: false });
    const manageWatchedEpisodes = vi.fn();
    fixture.componentInstance.manageWatchedEpisodes.subscribe(manageWatchedEpisodes);

    getButton('item-dialog-manage-watched-episodes').click();

    expect(getButton('item-dialog-manage-series-metadata')).toBeTruthy();
    expect(manageWatchedEpisodes).toHaveBeenCalled();
  });

  it('renders watch actions for permitted library movie items', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: true });
    const markAsWatched = vi.fn();
    fixture.componentInstance.markAsWatched.subscribe(markAsWatched);

    getButton('item-dialog-mark-watched').click();

    expect(markAsWatched).toHaveBeenCalled();
  });

  it('renders copy to series tracker for permitted library series items', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: false, series: true });
    const copyToWatching = vi.fn();
    fixture.componentInstance.copyToWatching.subscribe(copyToWatching);

    getButton('item-dialog-copy-watching').click();

    expect(copyToWatching).toHaveBeenCalled();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
  });

  it('renders open in watching and remove when series is already tracked', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: false, series: true, inWatching: true });
    const openInWatching = vi.fn();
    const removeFromWatching = vi.fn();
    fixture.componentInstance.openInWatching.subscribe(openInWatching);
    fixture.componentInstance.removeFromWatching.subscribe(removeFromWatching);

    getButton('item-dialog-open-in-watching').click();
    getButton('item-dialog-remove-watching').click();

    expect(openInWatching).toHaveBeenCalled();
    expect(removeFromWatching).toHaveBeenCalled();
    expect(queryButton('item-dialog-copy-watching')).toBeNull();
  });

  it('renders move actions for watch later movie and series items', () => {
    createComponent({ libraryItem: false, watchlist: true, movie: true });
    const moveToWatched = vi.fn();
    fixture.componentInstance.moveToWatched.subscribe(moveToWatched);
    getButton('item-dialog-move-watched').click();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
    expect(moveToWatched).toHaveBeenCalled();

    createComponent({ libraryItem: false, watchlist: true, movie: false, series: true });
    const moveToWatching = vi.fn();
    fixture.componentInstance.moveToWatching.subscribe(moveToWatching);
    getButton('item-dialog-move-watching').click();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
    expect(queryButton('item-dialog-copy-watching')).toBeNull();
    expect(moveToWatching).toHaveBeenCalled();
  });

  it('hides move to movie tracker when movie is already tracked', () => {
    createComponent({ libraryItem: false, watchlist: true, movie: true, inWatched: true });
    expect(queryButton('item-dialog-move-watched')).toBeNull();
  });

  it('hides move to series tracker when series is already tracked', () => {
    createComponent({ libraryItem: false, watchlist: true, movie: false, series: true, inWatching: true });
    expect(queryButton('item-dialog-move-watching')).toBeNull();
  });

  it('hides movie tracker actions when the feature is disabled', () => {
    createComponent({ watchedEnabled: false, libraryItem: true, movie: true });
    expect(queryButton('item-dialog-mark-watched')).toBeNull();

    createComponent({ watchedEnabled: false, libraryItem: false, watchlist: true, movie: true });
    expect(queryButton('item-dialog-move-watched')).toBeNull();
  });

  it('hides series tracker actions when the feature is disabled', () => {
    createComponent({ watchingEnabled: false, libraryItem: true, movie: false, series: true });
    expect(queryButton('item-dialog-copy-watching')).toBeNull();

    createComponent({ watchingEnabled: false, libraryItem: false, watchlist: true, movie: false, series: true });
    expect(queryButton('item-dialog-move-watching')).toBeNull();
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
