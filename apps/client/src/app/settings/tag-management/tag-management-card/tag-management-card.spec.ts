import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagManagementCard } from './tag-management-card';
import { TagManagementItemModel } from '../tag-management-model';

const tagManagement: TagManagementItemModel = {
  tag: '#old',
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
};

describe('TagManagementCard', () => {
  let fixture: ComponentFixture<TagManagementCard>;
  let component: TagManagementCard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TagManagementCard],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });

    fixture = TestBed.createComponent(TagManagementCard);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tagManagement', tagManagement);
    fixture.detectChanges();
  });

  it('prefills rename with the current tag and disables rename while unchanged', () => {
    const renameInput = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-input-#old"] input'
    ) as HTMLInputElement;
    const renameButton = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-#old"]'
    ) as HTMLButtonElement;

    expect(renameInput.value).toBe('#old');
    expect(renameButton.disabled).toBe(true);
  });

  it('derives translated labels and unchanged rename state', () => {
    expect(component['translations'].selectColor()).toBe('SelectColor');
    expect(component['translations'].rename()).toBe('Rename');
    expect(component['translations'].newTagName()).toBe('Placeholder.NewTagName');
    expect(component['translations'].weight()).toBe('Weight');
    expect(component['canRename']()).toBe(false);
  });

  it('emits the trimmed new tag when rename is clicked', () => {
    const emitted = vi.fn();
    component.rename.subscribe(emitted);
    const renameInput = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-input-#old"] input'
    ) as HTMLInputElement;
    const renameButton = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-#old"]'
    ) as HTMLButtonElement;

    renameInput.value = '  #new  ';
    renameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    renameButton.click();
    fixture.detectChanges();

    expect(emitted).toHaveBeenCalledWith('#new');
    expect(renameInput.value).toBe('#old');
  });

  it('keeps a draft rename when unrelated tag management settings change', () => {
    const renameInput = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-input-#old"] input'
    ) as HTMLInputElement;

    renameInput.value = '#draft';
    renameInput.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('tagManagement', { ...tagManagement, weight: 1 });
    fixture.detectChanges();

    expect(renameInput.value).toBe('#draft');
  });

  it('keeps rename disabled when the normalized tag is unchanged', () => {
    const renameInput = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-input-#old"] input'
    ) as HTMLInputElement;
    const renameButton = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-rename-#old"]'
    ) as HTMLButtonElement;

    renameInput.value = 'old';
    renameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(renameButton.disabled).toBe(true);
  });

  it('handles color selection and input changes', () => {
    const emittedColors: string[] = [];
    component.colorChange.subscribe((color) => emittedColors.push(color));
    const colorInput = document.createElement('input');
    const clickSpy = vi.spyOn(colorInput, 'click');

    component['onColorButtonClick'](colorInput, null);
    component['onColorButtonClick'](colorInput, '#123456');
    component['onColorInputChange']({ target: { value: '#abcdef' } } as unknown as Event);

    expect(emittedColors).toEqual(['#000000', '#abcdef']);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(component['contrastColor'](null)).toBeNull();
    expect(component['contrastColor']('#ffffff')).toBe('#000000');
  });

  it.each([
    [null, 0],
    ['', 0],
    ['2.5', 2.5],
    ['invalid', 0],
  ] as const)('normalizes weight %s to %s', (weight, expected) => {
    const emitted = vi.fn();
    component.weightChange.subscribe(emitted);

    component['onWeightChange'](weight);

    expect(emitted).toHaveBeenCalledWith(expected);
  });

  it('normalizes nullable checkbox values and rename input', () => {
    const imageBorder = vi.fn();
    const textColor = vi.fn();
    const imageBadge = vi.fn();
    component.imageBorderChange.subscribe(imageBorder);
    component.textColorChange.subscribe(textColor);
    component.imageBadgeChange.subscribe(imageBadge);

    component['onImageBorderChange'](true);
    component['onTextColorChange'](false);
    component['onImageBadgeChange'](null);
    component['onRenameInputChange'](null);

    expect(imageBorder).toHaveBeenCalledWith(true);
    expect(textColor).toHaveBeenCalledWith(false);
    expect(imageBadge).toHaveBeenCalledWith(false);
    expect(component['renameValue']()).toBe('');
    expect(component['canRename']()).toBe(false);
  });
});
