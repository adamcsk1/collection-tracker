import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Parser } from '@client/parser/parser';
import { ParserService } from '@client/parser/parser-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { setParserFilenamePattern, setParserRegexp, setParserTemplate } from '@services/parser/parser-util';
import { MD_TEMPLATE, PARSER_REGEXPS } from '@shared/constants/parser-const';
import { provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Parser component', () => {
  beforeEach(() => {
    setParserTemplate(MD_TEMPLATE);
    setParserFilenamePattern('{{Year}}-{{Type}}-{{Title}}.md');
    setParserRegexp('IMDbId', PARSER_REGEXPS.IMDbId);
    setParserRegexp('genre', PARSER_REGEXPS.genre);
    setParserRegexp('genreToken', PARSER_REGEXPS.genreToken);
    setParserRegexp('image', PARSER_REGEXPS.image);
    setParserRegexp('IMDbRate', PARSER_REGEXPS.IMDbRate);
    setParserRegexp('tags', PARSER_REGEXPS.tags);
    setParserRegexp('tagToken', PARSER_REGEXPS.tagToken);
    setParserRegexp('title', PARSER_REGEXPS.title);
    setParserRegexp('year', PARSER_REGEXPS.year);

    TestBed.configureTestingModule({
      imports: [Parser],
      providers: [provideRouter([]), provideStore(initialApiState, apiStateToken)],
    });

    TestBed.overrideComponent(Parser, {
      set: {
        template: '',
        providers: [
          {
            provide: ParserService,
            useValue: {
              generatePreviewContent: () => undefined,
              regenerateTemplates: () => undefined,
              storeFormData: () => undefined,
            },
          },
        ],
      },
    });
  });

  it('loads the filename pattern from parser cache on init', async () => {
    const fixture = TestBed.createComponent(Parser);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance['form'].filenamePattern().value()).toBe('{{Year}}-{{Type}}-{{Title}}.md');
  });

  it('marks the form invalid when filename pattern does not end with .md', async () => {
    const fixture = TestBed.createComponent(Parser);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance['form'].filenamePattern().value.set('{{Year}}-{{Title}}');
    fixture.detectChanges();

    expect(fixture.componentInstance['formErrors'].filenamePattern.invalidExtension()).toBe(true);
    expect(fixture.componentInstance['form']().invalid()).toBe(true);
  });
});
