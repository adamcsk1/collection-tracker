import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialogActions } from './item-dialog-actions';
import { ItemDialogTranslations } from './item-dialog-types';

const translations: ItemDialogTranslations = {
  actors: signal('Actors'),
  altPoster: signal('Poster image'),
  manageWatchedEpisodes: signal('Manage watched episodes'),
  manageSeriesMetadata: signal('Manage series metadata'),
  markAsUnwatched: signal('Mark as unwatched'),
  markAsWatched: signal('Mark as watched'),
  removeFavorite: signal('Remove favorite'),
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
  systemTags: signal('System tags'),
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
    fixture.componentRef.setInput('permissionDelete', overrides['permissionDelete'] ?? true);
    fixture.componentRef.setInput('seriesTracker', overrides['seriesTracker'] ?? false);
    fixture.componentRef.setInput('libraryItem', overrides['libraryItem'] ?? true);
    fixture.componentRef.setInput('watched', overrides['watched'] ?? false);
    fixture.componentRef.setInput('favorite', overrides['favorite'] ?? false);
    fixture.componentRef.setInput('internalCollectionTag', overrides['internalCollectionTag'] ?? null);
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

  it('renders series tracker actions when update permission is available', () => {
    createComponent({ seriesTracker: true, libraryItem: false });
    const manageWatchedEpisodes = vi.fn();
    fixture.componentInstance.manageWatchedEpisodes.subscribe(manageWatchedEpisodes);

    getButton('item-dialog-manage-watched-episodes').click();

    expect(getButton('item-dialog-manage-series-metadata')).toBeTruthy();
    expect(manageWatchedEpisodes).toHaveBeenCalled();
  });

  it('hides actions while editing and hides edit for internal collection tags', () => {
    createComponent({ editMode: true });
    expect(queryButton('item-dialog-delete')).toBeNull();

    createComponent({ internalCollectionTag: '#watch-later' });
    expect(queryButton('item-dialog-edit')).toBeNull();
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
