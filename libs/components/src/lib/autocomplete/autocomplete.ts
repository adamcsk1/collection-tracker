import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  InjectionToken,
  input,
  model,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutocompleteServiceInterface } from '@components/autocomplete/autocomplete-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { asyncScheduler } from 'rxjs';

export const AutocompleteService = new InjectionToken<AutocompleteServiceInterface>('AutocompleteService');

@Component({
  selector: 'libc-autocomplete',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe],
  templateUrl: './autocomplete.html',
  styleUrl: './autocomplete.css',
})
export class Autocomplete<T> implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inputElement = viewChild<ElementRef>('inputElement');
  private readonly _suggestions = signal<Array<string>>([]);
  private readonly autocompleteService = inject(AutocompleteService);
  private lastKeycode = '';
  protected readonly suggestions = this._suggestions.asReadonly();
  protected readonly inputContent = model('');
  protected readonly selectedSuggestion = model(-1);
  protected readonly hasValue = signal<boolean>(false);
  protected readonly focused = signal<boolean>(false);
  public readonly inputId = input<string>(crypto.randomUUID());
  public readonly control = input.required<FormControl<T>>();
  public readonly showReset = input<boolean>(false);
  public readonly placeholder = input<string>('');
  public readonly label = input<string>('');
  public readonly hint = input<string>();
  protected readonly hintId = computed<string | null>(() => (this.hint() ? `${this.inputId()}-hint` : null));
  protected readonly errorId = computed<string | null>(() => {
    const hasError = (this.control().touched || this.control().dirty) && !!this.control().errors;
    return hasError ? `${this.inputId()}-error` : null;
  });
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.hintId(), this.errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  public ngOnInit(): void {
    this.control()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.hasValue.set(!!value);
        this.setInput(value);
      });
  }

  protected onKeypress($event: KeyboardEvent): void {
    if ($event.code === 'Enter') {
      $event.preventDefault();
      $event.stopPropagation();
    }
  }

  protected onKeydown($event: KeyboardEvent): void {
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
    this.inputContent.set(($event.target! as HTMLElement).innerText.trim() || '');
    this.getSuggestions();
  }

  protected onAcceptSuggestion(index: number): void {
    this.selectedSuggestion.set(-1);
    this.setInput(this.suggestions()[index] as T);
    this._suggestions.set([]);
    this.inputElement()!.nativeElement.focus();

    asyncScheduler.schedule(() => {
      const selection = this.document.getSelection();
      const range = this.document.createRange();
      range.setStart(this.inputElement()!.nativeElement.childNodes[0], this.inputContent().length);
      range.collapse(true);
      selection!.removeAllRanges();
      selection!.addRange(range);
      this.inputElement()!.nativeElement.scrollLeft = this.inputElement()!.nativeElement.scrollWidth;
    });
  }

  protected onBlur(): void {
    asyncScheduler.schedule(() => this._suggestions.set([]), 100);
    this.focused.set(false);
  }

  protected onReset(): void {
    this.setInput('' as T);
    this._suggestions.set([]);
  }

  protected formatSuggestionText(text: string): string {
    if (this.autocompleteService.formatSuggestionText) return this.autocompleteService?.formatSuggestionText(text);
    return text;
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  private getSuggestions(): void {
    const suggestions = this.autocompleteService.getSuggestion(this.inputContent());
    if (suggestions.length > 0 && !suggestions.includes(this.inputContent())) this._suggestions.set(suggestions);
    else this._suggestions.set([]);
  }

  private setInput(value: T): void {
    if (value !== this.control().value) this.control().setValue(value);
    this.inputContent.set(value as string);
    this.inputElement()!.nativeElement.innerHTML = this.inputContent();
  }
}
