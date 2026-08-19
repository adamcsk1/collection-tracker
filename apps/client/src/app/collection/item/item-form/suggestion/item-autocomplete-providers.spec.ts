import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { Autocomplete, AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { GenreSuggestionService } from './genre-suggestion-service';
import { GenreSuggestionsProvider, TagSuggestionsProvider } from './item-autocomplete-providers';
import { TagSuggestionService } from './tag-suggestion-service';

@Component({
  selector: 'ct-item-autocomplete-providers-test-host',
  imports: [Autocomplete, FormField, GenreSuggestionsProvider, TagSuggestionsProvider],
  template: `
    <libc-autocomplete ctGenreSuggestions [formField]="genreField" />
    <libc-autocomplete ctTagSuggestions [formField]="tagField" />
  `,
})
class HostComponent {
  private readonly genre = signal('');
  private readonly tag = signal('');
  public readonly genreField = form(this.genre);
  public readonly tagField = form(this.tag);
}

describe('item autocomplete providers', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: ApiService, useValue: {} },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('provides genre suggestions to the genre autocomplete instance', () => {
    const autocompletes = fixture.debugElement.queryAll(By.directive(Autocomplete));

    expect(autocompletes[0].injector.get(AutocompleteService)).toBeInstanceOf(GenreSuggestionService);
  });

  it('provides tag suggestions to the tag autocomplete instance', () => {
    const autocompletes = fixture.debugElement.queryAll(By.directive(Autocomplete));

    expect(autocompletes[1].injector.get(AutocompleteService)).toBeInstanceOf(TagSuggestionService);
  });
});
