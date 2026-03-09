import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { WATCHED_TAG } from '@shared/constants/tags-const';
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
    const control = component['form'].selectedIMDbId();

    expect(control.value()).toBe('tt123');
    expect(control.touched()).toBe(true);
  });

  it('debounces search text updates before calling search', () => {
    const control = component['form'].searchText();

    control.value.set('matrix');
    vi.advanceTimersByTime(500);

    expect(service.search).toHaveBeenCalledWith('matrix');
  });

  it('invokes save and resets when mode is new', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', '#tag', 'new');
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('appends watched tag before saving in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', `#tag ${WATCHED_TAG}`, 'new');
    expect(formRoot.reset).toHaveBeenCalled();
    expect(component['form'].watched().value()).toBe(false);
  });

  it('saves only watched tag when no tags are provided in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', WATCHED_TAG, 'new');
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('exits when there is no selected IMDb id', () => {
    component['form'].selectedIMDbId().value.set(null);

    component['onSave']();

    expect(service.save).not.toHaveBeenCalled();
  });
});
