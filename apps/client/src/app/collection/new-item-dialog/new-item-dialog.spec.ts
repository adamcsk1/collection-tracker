import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewItemDialog } from './new-item-dialog';
import { NewItemDialogService } from './new-item-dialog-service';

describe('NewItemDialog component', () => {
  let fixture: ComponentFixture<NewItemDialog>;
  let component: NewItemDialog;
  let service: {
    matchedContent: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    service = {
      matchedContent: vi.fn(() => [{ text: 'First', value: 'tt123' }]),
      search: vi.fn(),
      save: vi.fn(() => of(undefined)),
    };

    TestBed.configureTestingModule({
      imports: [NewItemDialog],
      providers: [provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    TestBed.overrideComponent(NewItemDialog, {
      set: {
        template: '',
        providers: [
          { provide: NewItemDialogService, useValue: service },
          {
            provide: AutocompleteService,
            useValue: { getSuggestion: vi.fn(), formatSuggestionText: vi.fn() },
          },
        ],
      },
    });

    fixture = TestBed.createComponent(NewItemDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('preselects the first matched content and marks control as touched', () => {
    const control = component['formGroup'].controls.selectedIMDbId;

    expect(control.value).toBe('tt123');
    expect(control.touched).toBe(true);
  });

  it('debounces search text updates before calling search', () => {
    const control = component['formGroup'].controls.searchText;

    control.setValue('matrix');
    vi.advanceTimersByTime(500);

    expect(service.search).toHaveBeenCalledWith('matrix');
  });

  it('invokes save and resets when mode is new', () => {
    vi.spyOn(component['formGroup'], 'reset');
    component['formGroup'].controls.selectedIMDbId.setValue('tt123');
    component['formGroup'].controls.tags.setValue('#tag');

    component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', '#tag', 'new');
    expect(component['formGroup'].reset).toHaveBeenCalled();
  });

  it('exits when there is no selected IMDb id', () => {
    component['formGroup'].controls.selectedIMDbId.setValue(null);

    component['onSave']();

    expect(service.save).not.toHaveBeenCalled();
  });
});
