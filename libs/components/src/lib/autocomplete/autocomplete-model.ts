import { Observable } from 'rxjs';

export interface AutocompleteServiceInterface {
  getSuggestion(text: string): string[] | Observable<string[]>;
  formatSuggestionText?(text: string): string;
  formatSuggestionValue?(text: string): string;
}
