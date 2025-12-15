import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '@services/alert-service';
import { getParserRegexp, setParserRegexp } from '@services/parser/parser-util';
import { PARSER_REGEXPS } from '@shared/constants/parser-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OMDbResponseItemModel } from './omdb-model';
import { OMDbService } from './omdb-service';
import { initialOMDbState, OMDbState, omdbStateToken } from './omdb-store';

describe('OMDbService', () => {
  let service: OMDbService;
  let httpMock: HttpTestingController;
  let omdbState: NgxSimpleSignalStoreService<OMDbState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    setParserRegexp('IMDbId', getParserRegexp('IMDbId') ?? PARSER_REGEXPS.IMDbId);
  });

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        OMDbService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialOMDbState, omdbStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(OMDbService);
    httpMock = TestBed.inject(HttpTestingController);
    omdbState = TestBed.inject(omdbStateToken);
    omdbState.setState('apiKey', 'key123');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses an IMDb id in the search text without calling the API', () => {
    service.getMatchedContents('see tt0133093 now');

    expect(service.matchedContent()).toEqual([{ text: 'IMDb id: tt0133093', value: 'tt0133093' }]);
    httpMock.expectNone(() => true);
  });

  it('requests search results and maps them to select options', () => {
    service.getMatchedContents('Matrix');

    const searchRequest = httpMock.expectOne('https://www.omdbapi.com/?s=Matrix&apikey=key123');
    searchRequest.flush({
      Search: [
        {
          imdbID: 'tt0133093',
          imdbRating: '8.7',
          Plot: '',
          Poster: '',
          Type: 'movie',
          Title: 'The Matrix',
          Year: '1999',
          Director: '',
          Genre: '',
          Actors: '',
        },
      ],
    });

    expect(service.matchedContent()).toEqual([{ text: '(movie) The Matrix (1999)', value: 'tt0133093' }]);
  });

  it('sets an empty result list when search returns no matches', () => {
    service.getMatchedContents('Nothing');

    const searchRequest = httpMock.expectOne('https://www.omdbapi.com/?s=Nothing&apikey=key123');
    searchRequest.flush({ Search: [] });

    expect(service.matchedContent()).toEqual([]);
  });

  it('alerts and throws when search request fails', async () => {
    const search$ = service['getOMDbSearchData']({ s: 'ErrorSearch' }) as ReturnType<OMDbService['getOMDbSearchData']>;
    const promise = firstValueFrom(search$);

    const searchRequest = httpMock.expectOne('https://www.omdbapi.com/?s=ErrorSearch&apikey=key123');
    searchRequest.flush('failed', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toThrow('500');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('clears suggestions when response has no Search property', () => {
    service.getMatchedContents('NoProp');

    const searchRequest = httpMock.expectOne('https://www.omdbapi.com/?s=NoProp&apikey=key123');
    searchRequest.flush({});

    expect(service.matchedContent()).toEqual([]);
  });

  it('fetches a selected item by id', async () => {
    const selected$ = service.getSelectedContent('tt0133093').pipe(filter(Boolean));

    const detailRequest = httpMock.expectOne('https://www.omdbapi.com/?i=tt0133093&apikey=key123');
    detailRequest.flush({
      imdbID: 'tt0133093',
      imdbRating: '8.7',
      Plot: 'Plot text',
      Poster: '',
      Type: 'movie',
      Title: 'The Matrix',
      Year: '1999',
      Director: 'The Wachowskis',
      Genre: 'Sci-Fi',
      Actors: 'Keanu Reeves',
    } satisfies OMDbResponseItemModel);

    const result = await firstValueFrom(selected$);
    expect(result?.Title).toBe('The Matrix');
    expect(service.selectedContent()).toEqual(result);
  });

  it('alerts and throws when fetching selected item fails', async () => {
    const detail$ = service['getOMDbData']({
      i: 'tt0000000',
    }) as ReturnType<OMDbService['getOMDbData']>;
    const promise = firstValueFrom(detail$);

    const detailRequest = httpMock.expectOne('https://www.omdbapi.com/?i=tt0000000&apikey=key123');
    detailRequest.flush('missing', { status: 404, statusText: 'Not Found' });

    await expect(promise).rejects.toThrow('404');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
