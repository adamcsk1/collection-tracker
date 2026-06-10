import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Details } from './details';

@Component({
  selector: 'libc-test-details-host',
  imports: [Details],
  template: `<libc-details summary="Summary" [open]="open"><p>Body</p></libc-details>`,
})
class HostComponent {
  public open = false;
}

@Component({
  selector: 'libc-test-details-no-store-host',
  imports: [Details],
  template: `<libc-details summary="Summary" [storeOpenedState]="false"><p>Body</p></libc-details>`,
})
class HostNoStoreComponent {}

describe('Details component', () => {
  let storage: WebstorageService;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [WebstorageService],
    });

    storage = TestBed.inject(WebstorageService);
    getItemSpy = vi.spyOn(storage, 'getItem').mockReturnValue('false');
    setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {});
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('reads stored open state and persists on toggle', () => {
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
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const component = fixture.debugElement.children[0].children[0].componentInstance as Details;
    expect(component['storedOpened']()).toBe(true);

    const detailsElement = { open: true } as unknown as HTMLDetailsElement;
    component.onToggle({ target: { parentElement: detailsElement } } as unknown as Event);
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('DetailsSummary'), 'false');
  });
});

describe('Details component with storeOpenedState disabled', () => {
  let storage: WebstorageService;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostNoStoreComponent],
      providers: [WebstorageService],
    });

    storage = TestBed.inject(WebstorageService);
    getItemSpy = vi.spyOn(storage, 'getItem').mockReturnValue('false');
    setItemSpy = vi.spyOn(storage, 'setItem').mockImplementation(() => {});
  });

  it('does not read or persist open state when storeOpenedState is false', () => {
    const noStoreFixture = TestBed.createComponent(HostNoStoreComponent);
    noStoreFixture.detectChanges();

    const component = noStoreFixture.debugElement.children[0].children[0].componentInstance as Details;
    expect(component['storedOpened']()).toBe(false);
    expect(getItemSpy).not.toHaveBeenCalled();

    const detailsElement = { open: false } as unknown as HTMLDetailsElement;
    component.onToggle({ target: { parentElement: detailsElement } } as unknown as Event);
    noStoreFixture.detectChanges();

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
