export interface AutocompleteServiceInterface {
  getSuggestion(text: string): string[];
  formatSuggestionText?(text: string): string;
  formatSuggestionValue?(text: string): string;
}
