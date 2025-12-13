import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Details } from './details';

@Component({
  imports: [Details],
  template: `<libc-details summary="Summary" [open]="open"><p>Body</p></libc-details>`,
})
class HostComponent {
  public open = false;
}

describe('Details component', () => {
  let storage: WebstorageService;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [WebstorageService],
    });

    storage = TestBed.inject(WebstorageService);
    getItemSpy = vi.spyOn(storage, 'getItem').mockReturnValue('false');
    setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {});
  });

  it('reads stored open state and persists on toggle', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(getItemSpy).toHaveBeenCalled();
    const component = fixture.debugElement.children[0].children[0].componentInstance as Details;
    expect(component['storedOpened']()).toBe(false);

    const detailsElement = { open: false } as unknown as HTMLDetailsElement;
    component.onToggle({ target: { parentElement: detailsElement } } as unknown as Event);
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('DetailsSummary'), 'true');
  });

  it('initializes open state from storage when persisted as true', () => {
    getItemSpy.mockReturnValue('true');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Details;
    expect(component['storedOpened']()).toBe(true);

    const detailsElement = { open: true } as unknown as HTMLDetailsElement;
    component.onToggle({ target: { parentElement: detailsElement } } as unknown as Event);
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('DetailsSummary'), 'false');
  });
});
