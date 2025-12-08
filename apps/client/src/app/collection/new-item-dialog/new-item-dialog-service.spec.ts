import { TestBed } from '@angular/core/testing';
import { CollectionService } from '@client/collection/collection-service';
import { MdContentGeneratorService } from '@client/collection/new-item-dialog/md-content-generator/md-content-generator-service';
import { NewItemDialogService } from '@client/collection/new-item-dialog/new-item-dialog-service';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';

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
  let api: { create: jest.Mock };
  let omdb: { matchedContent: jest.Mock; getMatchedContents: jest.Mock; getSelectedContent: jest.Mock };
  let collection: { addCollectionItem: jest.Mock };
  let spinnerStore: NgxSimpleSignalStoreService<typeof initialSpinnerLoadingState>;
  let toastStore: NgxSimpleSignalStoreService<typeof initialToastState>;
  let portal: { close: jest.Mock };
  let mdContent: { getMdContent: jest.Mock };
  let translate: { translate: jest.Mock };

  beforeEach(() => {
    api = { create: jest.fn() };
    omdb = { matchedContent: jest.fn(() => []), getMatchedContents: jest.fn(), getSelectedContent: jest.fn() };
    collection = { addCollectionItem: jest.fn() };
    portal = { close: jest.fn() };
    mdContent = { getMdContent: jest.fn().mockReturnValue('md-content') };
    translate = { translate: jest.fn((key) => `t:${key}`) };

    TestBed.configureTestingModule({
      providers: [
        NewItemDialogService,
        { provide: ApiService, useValue: api },
        { provide: OMDbService, useValue: omdb },
        { provide: CollectionService, useValue: collection },
        { provide: MdContentGeneratorService, useValue: mdContent },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(NewItemDialogService);
    spinnerStore = TestBed.inject(spinnerLoadingStateToken);
    toastStore = TestBed.inject(toastStateToken);
  });

  it('search triggers OMDb lookup and shows spinner', () => {
    service.search('matrix');

    expect(spinnerStore.state.show()).toBe(true);
    expect(omdb.getMatchedContents).toHaveBeenCalledWith('matrix');
  });

  it('save persists selected content and closes when requested', (done) => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(of({ name: 'generated-name' }));

    service.save('tt123', '#tag', 'close').subscribe({
      next: () => {
        expect(mdContent.getMdContent).toHaveBeenCalledWith(expect.objectContaining({ Tags: '#tag' }));
        expect(api.create).toHaveBeenCalledWith('md-content');
        expect(collection.addCollectionItem).toHaveBeenCalledWith(
          { name: 'generated-name', content: 'md-content' },
          true
        );
        expect(toastStore.state.message()).toBe('t:Toast.NewItem');
        expect(portal.close).toHaveBeenCalled();
        expect(spinnerStore.state.show()).toBe(false);
        done();
      },
      error: done.fail,
    });
  });

  it('save stops spinner and rethrows on API error', (done) => {
    omdb.getSelectedContent.mockReturnValue(of(null, buildSelectedContent() as any));
    api.create.mockReturnValue(throwError(() => new Error('fail')));

    service.save('tt123', '#tag', null).subscribe({
      next: () => done.fail('expected error'),
      error: (error) => {
        expect(error).toEqual(new Error('fail'));
        expect(spinnerStore.state.show()).toBe(false);
        done();
      },
    });
  });
});
