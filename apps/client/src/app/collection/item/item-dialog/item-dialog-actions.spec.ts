import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialogTranslations } from '../item-form/item-form-model';
import { ItemDialogActions } from './item-dialog-actions';

const translations: ItemDialogTranslations = {
  actors: signal('Actors'),
  altPoster: signal('Poster image'),
  manageWatchedEpisodes: signal('Manage watched episodes'),
  manageSeriesMetadata: signal('Manage series metadata'),
  markAsUnwatched: signal('Mark as unwatched'),
  markAsWatched: signal('Mark as watched'),
  copyToSeriesTracker: signal('Copy to series tracker'),
  moveToMovieTracker: signal('Move to movie tracker'),
  moveToSeriesTracker: signal('Move to series tracker'),
  removeFavorite: signal('Remove favorite'),
  removeFromSeriesTracker: signal('Remove from series tracker'),
  markAsFavorite: signal('Mark as favorite'),
  fallbackNotAvailable: signal('N/A'),
  fallbackUnknownYear: signal('Unknown year'),
  genre: signal('Genre'),
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
    fixture.componentRef.setInput('seriesTracker', overrides['seriesTracker'] ?? false);
    fixture.componentRef.setInput('libraryItem', overrides['libraryItem'] ?? true);
    fixture.componentRef.setInput('watchLater', overrides['watchLater'] ?? false);
    fixture.componentRef.setInput('movie', overrides['movie'] ?? true);
    fixture.componentRef.setInput('series', overrides['series'] ?? false);
    fixture.componentRef.setInput('watched', overrides['watched'] ?? false);
    fixture.componentRef.setInput('favorite', overrides['favorite'] ?? false);
    fixture.componentRef.setInput('inSeriesTracker', overrides['inSeriesTracker'] ?? false);
    fixture.componentRef.setInput('inMovieTracker', overrides['inMovieTracker'] ?? false);
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
    createComponent({ seriesTracker: true, libraryItem: false });
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
    const copyToSeriesTracker = vi.fn();
    fixture.componentInstance.copyToSeriesTracker.subscribe(copyToSeriesTracker);

    getButton('item-dialog-copy-series-tracker').click();

    expect(copyToSeriesTracker).toHaveBeenCalled();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
  });

  it('renders remove from series tracker when series is already tracked', () => {
    createComponent({ libraryItem: true, permissionWatch: true, movie: false, series: true, inSeriesTracker: true });
    const removeFromSeriesTracker = vi.fn();
    fixture.componentInstance.removeFromSeriesTracker.subscribe(removeFromSeriesTracker);

    getButton('item-dialog-remove-series-tracker').click();

    expect(removeFromSeriesTracker).toHaveBeenCalled();
    expect(queryButton('item-dialog-copy-series-tracker')).toBeNull();
  });

  it('renders move actions for watch later movie and series items', () => {
    createComponent({ libraryItem: false, watchLater: true, movie: true });
    const moveToMovieTracker = vi.fn();
    fixture.componentInstance.moveToMovieTracker.subscribe(moveToMovieTracker);
    getButton('item-dialog-move-movie-tracker').click();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
    expect(moveToMovieTracker).toHaveBeenCalled();

    createComponent({ libraryItem: false, watchLater: true, movie: false, series: true });
    const moveToSeriesTracker = vi.fn();
    fixture.componentInstance.moveToSeriesTracker.subscribe(moveToSeriesTracker);
    getButton('item-dialog-move-series-tracker').click();
    expect(queryButton('item-dialog-mark-watched')).toBeNull();
    expect(queryButton('item-dialog-copy-series-tracker')).toBeNull();
    expect(moveToSeriesTracker).toHaveBeenCalled();
  });

  it('hides move to movie tracker when movie is already tracked', () => {
    createComponent({ libraryItem: false, watchLater: true, movie: true, inMovieTracker: true });
    expect(queryButton('item-dialog-move-movie-tracker')).toBeNull();
  });

  it('hides move to series tracker when series is already tracked', () => {
    createComponent({ libraryItem: false, watchLater: true, movie: false, series: true, inSeriesTracker: true });
    expect(queryButton('item-dialog-move-series-tracker')).toBeNull();
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
