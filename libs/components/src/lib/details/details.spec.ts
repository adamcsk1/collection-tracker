import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WebstorageService } from '@services/webstorage/webstorage-service';
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
  let getItemSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [WebstorageService],
    });

    storage = TestBed.inject(WebstorageService);
    getItemSpy = jest.spyOn(storage, 'getItem').mockReturnValue('false');
    setItemSpy = jest.spyOn(storage, 'setItem').mockImplementation(() => {});
  });

  it('reads stored open state and persists on toggle', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(getItemSpy).toHaveBeenCalled();
    const detailsElement = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(detailsElement.open).toBe(false);

    const summaryElement = fixture.nativeElement.querySelector('summary') as HTMLElement;
    summaryElement.click();
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('DetailsSummary'), 'true');
  });

  it('initializes open state from storage when persisted as true', () => {
    getItemSpy.mockReturnValue('true');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const detailsElement = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(detailsElement.open).toBe(true);

    const summaryElement = fixture.nativeElement.querySelector('summary') as HTMLElement;
    summaryElement.click();
    fixture.detectChanges();

    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('DetailsSummary'), 'false');
  });
});
