import { TestBed } from '@angular/core/testing';
import { CollectionService } from '@client/collection/collection-service';
import { CollectionModel } from '@client/collection/collection-model';
import { TemplateRegenerationService } from '@client/parser/template-regeneration-service';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { provideStore } from 'ngx-simple-signal-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildCollectionItem = (name: string) =>
  ({
    name,
    IMDbId: `tt${name}`,
    rawContent: `raw-${name}`,
    title: name,
    image: '',
    genre: [],
    tags: [],
    year: null,
    rate: '',
  }) as CollectionModel[number];

describe('TemplateRegenerationService', () => {
  let service: TemplateRegenerationService;
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let omdbService: { getSelectedContent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { loadCollection: vi.fn() };
    omdbService = { getSelectedContent: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        TemplateRegenerationService,
        { provide: CollectionService, useValue: collectionService },
        { provide: OMDbService, useValue: omdbService },
        { provide: ApiService, useValue: { update: vi.fn() } },
        { provide: MdContentGeneratorService, useValue: { getMdContent: vi.fn() } },
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
});
