import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { MainService } from '@client/main/main-service';
import { TokenValidationService } from '@client/main/token-validation-service';
import { initialOMDbState, omdbStateToken } from '@services/omdb/omdb-store';
import { ParserService } from '@services/parser/parser-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
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
  let omdbState: NgxSimpleSignalStoreService<typeof initialOMDbState>;
  let mainService: { tokenValid: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mainService = { tokenValid: vi.fn(() => null) };
    collectionService = { loadCollection: vi.fn() };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        TokenValidationService,
        { provide: MainService, useValue: mainService },
        { provide: CollectionService, useValue: collectionService },
        { provide: ParserService, useValue: { preloadUserParserConfig: vi.fn(() => of(void 0)) } },
        provideStore(initialOMDbState, omdbStateToken),
        provideRouter([]),
        { provide: Router, useValue: router },
      ],
    });

    omdbState = TestBed.inject(omdbStateToken) as NgxSimpleSignalStoreService<typeof initialOMDbState>;
    service = TestBed.inject(TokenValidationService);
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('navigates to settings and loads collection when token is valid without OMDb key', () => {
    mainService.tokenValid.mockReturnValue(true);

    service.startValidation();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['settings']);
    expect(collectionService.loadCollection).toHaveBeenCalled();
  });

  it('loads collection without navigating when token is valid and OMDb key exists', () => {
    mainService.tokenValid.mockReturnValue(true);
    omdbState.setState('apiKey', 'abc123');

    service.startValidation();
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).toHaveBeenCalled();
  });

  it('redirects to login when token validation fails', () => {
    mainService.tokenValid.mockReturnValue(false);
    const redirectSpy = vi.spyOn(MainUtil, 'redirectToLogin').mockImplementation(() => {});

    service.startValidation();

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
