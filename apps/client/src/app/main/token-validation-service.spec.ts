import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CollectionService } from '../collection/collection-service';
import { MainService } from './main-service';
import { TokenValidationService } from './token-validation-service';
import { SettingsService } from '../settings/settings-service';
import { TagConfigsService } from '../tag-configs/tag-configs-service';
import { ParserService } from '@services/parser/parser-service';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as MainUtil from './main-util';

@Component({ template: '', standalone: true })
class TestHostComponent {}

describe('TokenValidationService', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let service: TokenValidationService;
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let mainService: { tokenValid: ReturnType<typeof vi.fn> };
  let parserService: { preloadUserParserConfig: ReturnType<typeof vi.fn> };
  let settingsService: { preloadUserSettings: ReturnType<typeof vi.fn> };
  let tagConfigsService: { preloadUserTagConfigs: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mainService = { tokenValid: vi.fn(() => null) };
    collectionService = { loadCollection: vi.fn() };
    router = { navigate: vi.fn() };
    parserService = { preloadUserParserConfig: vi.fn(() => of(void 0)) };
    settingsService = { preloadUserSettings: vi.fn(() => of(void 0)) };
    tagConfigsService = { preloadUserTagConfigs: vi.fn(() => of(void 0)) };

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        TokenValidationService,
        { provide: MainService, useValue: mainService },
        { provide: CollectionService, useValue: collectionService },
        { provide: ParserService, useValue: parserService },
        { provide: SettingsService, useValue: settingsService },
        { provide: TagConfigsService, useValue: tagConfigsService },
        provideRouter([]),
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(TokenValidationService);
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('loads collection when token is valid', () => {
    mainService.tokenValid.mockReturnValue(true);

    service.startValidation();
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).toHaveBeenCalled();
    expect(settingsService.preloadUserSettings).toHaveBeenCalled();
    expect(parserService.preloadUserParserConfig).toHaveBeenCalled();
    expect(tagConfigsService.preloadUserTagConfigs).toHaveBeenCalled();
  });

  it('redirects to login when token validation fails', () => {
    mainService.tokenValid.mockReturnValue(false);
    const redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});

    service.startValidation();
    fixture.detectChanges();

    expect(redirectSpy).toHaveBeenCalled();
    redirectSpy.mockRestore();
  });

  it('does not navigate or load collection when token is null (pending)', () => {
    service.startValidation();
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).not.toHaveBeenCalled();
  });
});
