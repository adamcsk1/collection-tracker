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
});
