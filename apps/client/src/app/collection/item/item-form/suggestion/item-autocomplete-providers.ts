import { Directive } from '@angular/core';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { GenreSuggestionService } from './genre-suggestion-service';
import { TagSuggestionService } from './tag-suggestion-service';

@Directive({
  selector: 'libc-autocomplete[ctGenreSuggestions]',
  providers: [GenreSuggestionService, { provide: AutocompleteService, useExisting: GenreSuggestionService }],
})
export class GenreSuggestionsProvider {}

@Directive({
  selector: 'libc-autocomplete[ctTagSuggestions]',
  providers: [TagSuggestionService, { provide: AutocompleteService, useExisting: TagSuggestionService }],
})
export class TagSuggestionsProvider {}
