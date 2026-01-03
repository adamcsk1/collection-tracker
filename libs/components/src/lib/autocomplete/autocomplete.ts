import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, FormsModule, NgControl, ReactiveFormsModule } from '@angular/forms';
import { AutocompleteServiceInterface } from '@components/autocomplete/autocomplete-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler } from 'rxjs';

export const AutocompleteService = new InjectionToken<AutocompleteServiceInterface>('AutocompleteService');

@Component({
  selector: 'libc-autocomplete',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, FormsModule],
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
})
export class Autocomplete<T> implements OnInit, ControlValueAccessor {
  private readonly destroyRef = inject(DestroyRef);
  private readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');
  private readonly _suggestions = signal<Array<string>>([]);
  private readonly autocompleteService = inject(AutocompleteService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private lastKeycode = '';
  private lastEventWasAccept = false;
  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};
  protected readonly suggestions = this._suggestions.asReadonly();
  protected readonly value = signal('');
  protected readonly selectedSuggestion = signal(-1);
  protected readonly hasValue = computed(() => !!this.value());
  protected readonly focused = signal<boolean>(false);
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly label = input<string>('');
  public readonly hint = input<string>();
  public readonly mandatory = input<boolean>(false);
  protected readonly control = computed<FormControl<T> | null>(() => this.ngControl?.control as FormControl<T>);
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.inputId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    const control = this.control();
    const hasError = !!control && (control.touched || control.dirty) && !!control.errors;
    return hasError ? `${this.inputId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  protected readonly isDisabled = signal(false);

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  public ngOnInit(): void {
    const control = this.control();
    control?.valueChanges?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.value.set((value as string) ?? '');
    });
  }

  public writeValue(value: T | null): void {
    this.value.set((value as string) ?? '');
  }

  public registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected onKeypress($event: KeyboardEvent): void {
    if ($event.code === 'Enter') {
      $event.preventDefault();
      $event.stopPropagation();
    }
  }

  protected onKeydown($event: KeyboardEvent): void {
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
    const inputText = ($event.target as HTMLInputElement).value;
    this.value.set(inputText);
    this.onChange(this.value() as T);
    if ($event.code !== 'Escape' && !this.lastEventWasAccept) this.getSuggestions();
    else this._suggestions.set([]);
  }

  protected onAcceptSuggestion(index: number): void {
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
    this.onTouched();
    asyncScheduler.schedule(() => this._suggestions.set([]), 100);
    this.focused.set(false);
  }

  protected onReset(): void {
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
    if (this.value().trim() === '') {
      this._suggestions.set([]);
      return;
    }

    const suggestions = this.autocompleteService.getSuggestion(this.value());
    if (suggestions.length > 0 && !suggestions.includes(this.value())) this._suggestions.set(suggestions);
    else this._suggestions.set([]);
  }

  private setInput(value: T): void {
    this.value.set((value as string) ?? '');
    this.onChange(value);
  }
}
