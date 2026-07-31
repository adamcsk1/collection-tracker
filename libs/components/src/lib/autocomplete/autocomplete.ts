import {
  Component,
  computed,
  ElementRef,
  inject,
  InjectionToken,
  input,
  model,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { asyncScheduler, isObservable, Subscription } from 'rxjs';
import { createFormControlA11y } from '../utils/form-control-a11y-util';
import { AutocompleteServiceInterface, AutocompleteSuggestionListPlacement } from './autocomplete-model';

export const AutocompleteService = new InjectionToken<AutocompleteServiceInterface>('AutocompleteService');

const SUGGESTION_NAVIGATION_KEY_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);
const DEFAULT_SUGGESTION_DEBOUNCE_MS = 300;

@Component({
  selector: 'libc-autocomplete',
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
})
export class Autocomplete<T> implements FormValueControl<T | null>, OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');
  private readonly _suggestions = signal<string[]>([]);
  private readonly autocompleteService = inject(AutocompleteService);
  private suggestionDebounce: Subscription | null = null;
  private suggestionRequest: Subscription | null = null;
  private lastKeycode = '';
  private lastEventWasAccept = false;
  protected readonly translations = {
    suggestions: computed(() => this.ngxSignalTranslate.translate('Suggestions')),
    resetInput: computed(() => this.ngxSignalTranslate.translate('ResetInput')),
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
  };
  protected readonly suggestions = this._suggestions.asReadonly();
  public readonly value = model<T | null>(null);
  public readonly touched = model(false);
  public readonly dirty = input(false);
  public readonly disabled = input(false);
  public readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  protected readonly selectedSuggestion = signal(-1);
  protected readonly hasValue = computed(() => {
    const value = this.value();
    return value !== null && `${value}`.length > 0;
  });
  protected readonly focused = signal<boolean>(false);
  protected readonly showSuggestionsAbove = computed(() => this.suggestionListPlacement() === 'top');
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly showReset = input<boolean>(false);
  public readonly suggestionListPlacement = input<AutocompleteSuggestionListPlacement>('bottom');
  public readonly placeholder = input<string>('');
  public readonly label = input<string>('');
  public readonly hint = input<string>();
  public readonly mandatory = input<boolean>(false);
  public readonly suggestionDebounceMs = input(DEFAULT_SUGGESTION_DEBOUNCE_MS);
  public readonly userEvent = output<void>();
  public readonly userAcceptSuggestionEvent = output<void>();
  private readonly _a11y = createFormControlA11y(this.inputId, this.hint, this.touched, this.dirty, this.errors);
  protected readonly showError = this._a11y.showError;
  protected readonly hintId = this._a11y.hintId;
  protected readonly errorId = this._a11y.errorId;
  protected readonly describedBy = this._a11y.describedBy;
  protected readonly hasRequiredError = this._a11y.hasRequiredError;

  public ngOnDestroy(): void {
    this.suggestionDebounce?.unsubscribe();
    this.suggestionRequest?.unsubscribe();
  }

  protected onKeypress($event: KeyboardEvent): void {
    if ($event.code === 'Enter') {
      $event.preventDefault();
      $event.stopPropagation();
    }
  }

  protected onKeydown($event: KeyboardEvent): void {
    this.userEvent.emit();
    this.lastEventWasAccept = false;

    if ($event.code === 'Tab' && this.lastKeycode === 'Tab') {
      this.lastKeycode = '';
      return;
    }

    this.lastKeycode = $event.code;

    if (['ArrowUp', 'ArrowDown', 'Tab'].includes($event.code)) {
      $event.preventDefault();
      $event.stopPropagation();
    }

    if ($event.code === 'Tab' || $event.code === 'Enter') {
      if (this.suggestions().length > 0) {
        this.onAcceptSuggestion(this.selectedSuggestion() === -1 ? 0 : this.selectedSuggestion());
      }
    } else if ($event.code === 'ArrowUp' && this._suggestions().length && this.selectedSuggestion() > 0) {
      this.selectedSuggestion.update((state) => state - 1);
    } else if (
      $event.code === 'ArrowDown' &&
      this._suggestions().length &&
      this.selectedSuggestion() < this._suggestions().length - 1
    ) {
      this.selectedSuggestion.update((state) => state + 1);
    }
  }

  protected onKeyup($event: KeyboardEvent): void {
    if (SUGGESTION_NAVIGATION_KEY_CODES.has($event.code)) return;

    const inputText = ($event.target as HTMLInputElement).value;
    this.value.set(inputText as T);
    if (this.suggestionDebounce) this.suggestionDebounce.unsubscribe();
    this.suggestionRequest?.unsubscribe();
    if ($event.code !== 'Escape' && !this.lastEventWasAccept) {
      this.suggestionDebounce = asyncScheduler.schedule(() => this.getSuggestions(), this.suggestionDebounceMs());
    } else {
      this._suggestions.set([]);
    }
  }

  protected onAcceptSuggestion(index: number): void {
    if (this.suggestionDebounce) {
      this.suggestionDebounce.unsubscribe();
      this.suggestionDebounce = null;
    }
    this.suggestionRequest?.unsubscribe();
    this.userAcceptSuggestionEvent.emit();
    this.lastEventWasAccept = true;
    this.selectedSuggestion.set(-1);
    if (this.autocompleteService.formatSuggestionValue) {
      const formatted = this.autocompleteService.formatSuggestionValue(this.suggestions()[index]);
      this.setInput(formatted as T);
    } else this.setInput(this.suggestions()[index] as T);
    this._suggestions.set([]);
    this.inputElement()?.nativeElement.focus();
  }

  protected onBlur(): void {
    if (this.suggestionDebounce) {
      this.suggestionDebounce.unsubscribe();
      this.suggestionDebounce = null;
    }
    this.suggestionRequest?.unsubscribe();
    this.touched.set(true);
    asyncScheduler.schedule(() => this._suggestions.set([]), 100);
    this.focused.set(false);
  }

  protected onReset(): void {
    if (this.suggestionDebounce) {
      this.suggestionDebounce.unsubscribe();
      this.suggestionDebounce = null;
    }
    this.suggestionRequest?.unsubscribe();
    this.setInput('' as T);
    this._suggestions.set([]);
  }

  protected formatSuggestionText(text: string): string {
    if (this.autocompleteService.formatSuggestionText) return this.autocompleteService.formatSuggestionText(text);
    return text;
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  private getSuggestions(): void {
    const value = this.value();
    if (typeof value !== 'string' || value.trim() === '') {
      this._suggestions.set([]);
      return;
    }

    this.suggestionRequest?.unsubscribe();
    const suggestions = this.autocompleteService.getSuggestion(value);
    if (isObservable(suggestions)) {
      this.suggestionRequest = suggestions.subscribe((result) => this.setSuggestions(result, value));
      return;
    }

    this.setSuggestions(suggestions, value);
  }

  private setSuggestions(suggestions: string[], value: string): void {
    if (suggestions.length > 0 && !suggestions.includes(value)) this._suggestions.set(suggestions);
    else this._suggestions.set([]);
  }

  private setInput(value: T): void {
    this.value.set(value);
  }
}
