import { TestBed } from '@angular/core/testing';
import { CollectionModel } from '@shared/models/collection-item-model';
import { CollectionService } from '../collection/collection-service';
import { TemplateRegenerationService } from './template-regeneration-service';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { generateMdContent } from '@shared/parser/utils/generate-md-content-util';

vi.mock('@shared/parser/utils/generate-md-content-util', () => ({ generateMdContent: vi.fn() }));
import { setParserTemplate } from '@shared/parser/parser-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildCollectionItem = (name: string): CollectionModel[number] => ({
  name,
  IMDbId: `tt${name}`,
  rawContent: `raw-${name}`,
  rawContentLower: `raw-${name}`.toLowerCase(),
  title: name,
  titleLower: name.toLowerCase(),
  image: '',
  genre: [],
  tags: [],
  year: null,
  rate: '',
  hash: '',
  plot: '',
});

describe('TemplateRegenerationService', () => {
  let service: TemplateRegenerationService;
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let omdbService: { getSelectedContent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { loadCollection: vi.fn() };
    omdbService = { getSelectedContent: vi.fn() };
    setParserTemplate('{{Title}} {{Tags}}');

    TestBed.configureTestingModule({
      providers: [
        TemplateRegenerationService,
        { provide: CollectionService, useValue: collectionService },
        { provide: OMDbService, useValue: omdbService },
        { provide: ApiService, useValue: { update: vi.fn(() => of(undefined)) } },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn(() => '') } },
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(TemplateRegenerationService);
  });

  it('has initial state with running: false', () => {
    expect(service.state().running).toBe(false);
    expect(service.state().count).toBe(0);
    expect(service.state().checked).toBe(0);
    expect(service.state().errors).toBe(0);
  });

  it('start() sets running to true and sets count', () => {
    const collection: CollectionModel = [buildCollectionItem('A'), buildCollectionItem('B')];
    omdbService.getSelectedContent.mockReturnValue({ pipe: () => ({ subscribe: () => {} }) });

    service.start(collection);

    expect(service.state().running).toBe(true);
    expect(service.state().count).toBe(2);
  });

  it('start() with empty collection finishes immediately', () => {
    service.start([]);

    expect(service.state().running).toBe(false);
    expect(collectionService.loadCollection).toHaveBeenCalled();
  });

  it('filters out movie and series tags before regenerating content', async () => {
    const collectionItem = buildCollectionItem('A');
    collectionItem.tags = ['#movie', '#space', '#series', '#action'];

    vi.mocked(generateMdContent).mockReturnValue('generated-content');

    omdbService.getSelectedContent.mockReturnValue(
      of(null, {
        imdbID: `ttA`,
        Title: 'title',
        Year: '2000',
      } as never)
    );
    vi.useFakeTimers();

    service.start([collectionItem]);

    await vi.advanceTimersByTimeAsync(600);
    expect(generateMdContent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        imdbID: `ttA`,
        Title: 'title',
        Year: '2000',
        Tags: '#space #action',
      }) as never
    );
    vi.useRealTimers();
  });
});
