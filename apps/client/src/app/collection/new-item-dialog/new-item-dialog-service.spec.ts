import { TestBed } from '@angular/core/testing';
import { CollectionService } from '../collection-service';
import { NewItemDialogService } from './new-item-dialog-service';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { setParserFilenamePattern, setParserTemplate } from '@shared/parser/parser-util';
import { generateMdContent } from '@shared/parser/utils/generate-md-content-util';

vi.mock('@shared/parser/utils/generate-md-content-util', () => ({
  generateMdContent: vi.fn().mockReturnValue('md-content'),
}));
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSelectedContent = () => ({
  Title: 'Title',
  Year: '2020',
  imdbID: 'tt123',
  imdbRating: '9.0',
  Plot: 'Plot',
  Poster: 'poster-url',
  Director: 'Director',
  Genre: 'Genre',
  Actors: 'Actors',
  Type: 'movie',
});

describe('NewItemDialogService', () => {
  let service: NewItemDialogService;
  let api: { create: ReturnType<typeof vi.fn> };
  let omdb: {
    matchedContent: ReturnType<typeof vi.fn>;
    getMatchedContents: ReturnType<typeof vi.fn>;
    getSelectedContent: ReturnType<typeof vi.fn>;
  };
  let collection: { addCollectionItem: ReturnType<typeof vi.fn> };
  let spinnerStore: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let toastStore: NgxSimpleSignalStoreService<ToastState>;
  let portal: { close: ReturnType<typeof vi.fn> };
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { create: vi.fn() };
    omdb = { matchedContent: vi.fn(() => []), getMatchedContents: vi.fn(), getSelectedContent: vi.fn() };
    collection = { addCollectionItem: vi.fn() };
    portal = { close: vi.fn() };
    translate = { translate: vi.fn((key) => `t:${key}`) };

    TestBed.configureTestingModule({
      providers: [
        NewItemDialogService,
        { provide: ApiService, useValue: api },
        { provide: OMDbService, useValue: omdb },
        { provide: CollectionService, useValue: collection },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(NewItemDialogService);
    spinnerStore = TestBed.inject(spinnerLoadingStateToken);
    toastStore = TestBed.inject(toastStateToken);
    setParserFilenamePattern('{{Year}}-{{Type}}-{{Title}}.md');
    setParserTemplate('{{Title}} {{Tags}}');
  });

  it('search triggers OMDb lookup and shows spinner', () => {
    service.search('matrix');

    expect(spinnerStore.state.show()).toBe(true);
    expect(omdb.getMatchedContents).toHaveBeenCalledWith('matrix');
  });

  it('save persists selected content and closes when requested', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ name: 'generated-name' }));

    await firstValueFrom(service.save('tt123', '#tag', 'close'));

    expect(generateMdContent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ Tags: '#tag' }));
    expect(api.create).toHaveBeenCalledWith('md-content', '2020-movie-Title.md');
    expect(collection.addCollectionItem).toHaveBeenCalledWith(
      {
        name: 'generated-name',
        content: 'md-content',
        hash: '',
      },
      true
    );
    expect(toastStore.state.message()).toBe('t:Toast.NewItem');
    expect(portal.close).toHaveBeenCalled();
    expect(spinnerStore.state.show()).toBe(false);
  });

  it('save stops spinner and rethrows on API error', async () => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    await expect(firstValueFrom(service.save('tt123', '#tag', null))).rejects.toEqual(new Error('fail'));
    expect(spinnerStore.state.show()).toBe(false);
  });
});
