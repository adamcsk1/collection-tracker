export interface AutocompleteServiceInterface {
  getSuggestion(text: string): Array<string>;
  formatSuggestionText?(text: string): string;
}
