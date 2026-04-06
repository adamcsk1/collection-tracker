import { TestBed } from '@angular/core/testing';
import { CollectionService } from '@client/collection/collection-service';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { ParserModel } from '@client/parser/parser-model';
import { TemplateRegenerationService } from '@client/parser/template-regeneration-service';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { AlertService } from '@services/alert-service';
import { ConfirmService } from '@services/confirm-service';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { ParserService as MainParserService } from '@services/parser/parser-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParserService } from './parser-service';

const buildFormData = (): ParserModel => ({
  IMDbId: '/tt\\d+/i',
  genre: '/genre/i',
  genreToken: '/token/i',
  image: '/image/i',
  IMDbRate: '/rate/i',
  tags: '/tags/i',
  tagToken: '/tagtoken/i',
  title: '/title/i',
  year: '/\\d{4}/i',
  content: '/content/i',
  mdTemplate: '{{Title}}',
  filenamePattern: '{Title}',
});

describe('ParserService (client)', () => {
  let service: ParserService;
  let mainParserService: { syncUserParserConfig: ReturnType<typeof vi.fn> };
  let collection: { loadCollection: ReturnType<typeof vi.fn> };
  let alert: { show: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };
  let mdContentGenerator: { getMdContent: ReturnType<typeof vi.fn> };
  let templateRegenerationStart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mainParserService = { syncUserParserConfig: vi.fn(() => of(void 0)) };
    collection = { loadCollection: vi.fn() };
    alert = { show: vi.fn() };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    mdContentGenerator = { getMdContent: vi.fn(() => '# Preview') };
    templateRegenerationStart = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ParserService,
        { provide: MainParserService, useValue: mainParserService },
        { provide: CollectionService, useValue: collection },
        { provide: AlertService, useValue: alert },
        { provide: ConfirmService, useValue: confirm },
        { provide: MdContentGeneratorService, useValue: mdContentGenerator },
        {
          provide: TemplateRegenerationService,
          useValue: {
            start: templateRegenerationStart,
            state: vi.fn(() => ({ running: false, count: 0, checked: 0, errors: 0 })),
          },
        },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ParserService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('storeFormData', () => {
    it('sets spinner to true before syncing', () => {
      mainParserService.syncUserParserConfig = vi.fn(() => EMPTY);
      const spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<SpinnerLoadingState>;

      service.storeFormData(buildFormData());

      expect(spinnerState.state.show()).toBe(true);
    });

    it('hides spinner and shows toast after successful sync', () => {
      vi.useFakeTimers();
      const spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<SpinnerLoadingState>;
      const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

      service.storeFormData(buildFormData());
      vi.runAllTimers();

      expect(spinnerState.state.show()).toBe(false);
      expect(toastState.state.message()).toBe('Toast.ParserSettingsSaved');
    });

    it('loads collection after successful sync', () => {
      vi.useFakeTimers();

      service.storeFormData(buildFormData());
      vi.runAllTimers();

      expect(collection.loadCollection).toHaveBeenCalled();
    });

    it('hides spinner when sync errors', () => {
      // Use fake timers to prevent the async RxJS unhandled-error setTimeout from firing
      vi.useFakeTimers();
      mainParserService.syncUserParserConfig = vi.fn(() => throwError(() => new Error('sync failed')));
      const spinnerState = TestBed.inject(spinnerLoadingStateToken) as NgxSimpleSignalStoreService<SpinnerLoadingState>;

      service.storeFormData(buildFormData());

      expect(spinnerState.state.show()).toBe(false);
      vi.clearAllTimers();
    });
  });

  describe('generatePreviewContent', () => {
    it('calls alert.show with the preview content on success', () => {
      mdContentGenerator.getMdContent = vi.fn(() => '# Title\nsome content');

      service.generatePreviewContent(buildFormData());

      expect(alert.show).toHaveBeenCalled();
    });

    it('shows error message and restores parser cache when content generation fails', () => {
      mdContentGenerator.getMdContent = vi.fn(() => {
        throw new Error('generation failed');
      });

      service.generatePreviewContent(buildFormData());

      expect(alert.show).toHaveBeenCalledWith('Message.PreviewGenerationError');
    });
  });

  describe('regenerateTemplates', () => {
    it('starts template regeneration and shows blocker when confirmed', () => {
      const blockerState = TestBed.inject(blockerLoadingStateToken);

      service.regenerateTemplates();

      expect(templateRegenerationStart).toHaveBeenCalled();
      expect(blockerState.state.show()).toBe(true);
    });

    it('does not start regeneration when user cancels', () => {
      confirm.ifConfirmed = vi.fn(() => EMPTY);

      service.regenerateTemplates();

      expect(templateRegenerationStart).not.toHaveBeenCalled();
    });
  });
});
