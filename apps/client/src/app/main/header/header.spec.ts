import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionService } from '@client/collection/collection-service';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { Header } from './header';

const setBodyWidth = (width: number) =>
  Object.defineProperty(document.body, 'offsetWidth', { value: width, configurable: true });

describe('Header component', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let collection: { loadCollection: jest.Mock };
  let api: { logout: jest.Mock };
  let webstorage: { clear: jest.Mock };
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    collection = { loadCollection: jest.fn() };
    api = { logout: jest.fn(() => of(void 0)) };
    webstorage = { clear: jest.fn() };

    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: CollectionService, useValue: collection },
        { provide: ApiService, useValue: api },
        { provide: WebstorageService, useValue: webstorage },
        provideStore(initialMainState, mainStateToken),
      ],
    });

    TestBed.overrideComponent(Header, { set: { template: '' } });

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;
    fixture.detectChanges();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('toggles the menu visibility based on event and viewport width', () => {
    setBodyWidth(500);
    component['onShowMenu'](new Event('mouseenter'));
    expect(component['showMenu']()).toBe(true);

    component['onHideMenu']();
    expect(component['showMenu']()).toBe(false);

    setBodyWidth(300);
    component['onShowMenu'](new Event('mouseenter'));
    expect(component['showMenu']()).toBe(false);
  });

  it('triggers collection sync', () => {
    component['onSync']();

    expect(collection.loadCollection).toHaveBeenCalled();
  });

  it('logs out successfully and clears storage when configured', () => {
    mainState.setState('clearLocalStorageAfterLogout', true);

    component['onLogout']();

    expect(webstorage.clear).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalled();
  });

  it('handles logout errors and still redirects', () => {
    mainState.setState('clearLocalStorageAfterLogout', true);
    api.logout.mockReturnValue(throwError(() => new Error('fail')));

    component['onLogout']();

    expect(webstorage.clear).toHaveBeenCalled();
    expect(api.logout).toHaveBeenCalled();
  });
});
