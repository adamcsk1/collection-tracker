import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Params } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Favorites } from './favorites';

@Component({
  selector: 'ct-list',
  template: '<ng-content select="[list-empty]" />',
})
class ListStub {
  public readonly hideFloatActions = input(false);
  public readonly showAddButton = input(true);
  public readonly showAiSearchButton = input(true);
  public readonly showRandomPickButton = input(true);
  public readonly orderStorageKey = input('');
  public readonly routeSearchText = input('');
  public readonly routeFilterKey = input('');
  public readonly dataSource = input<unknown>();
}

describe('Favorites', () => {
  const searchItems = vi.fn();
  const createFixture = (queryParams: Params = {}): ComponentFixture<Favorites> => {
    searchItems.mockReset();
    TestBed.configureTestingModule({
      imports: [Favorites],
      providers: [
        { provide: ApiService, useValue: { searchItems } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams }, queryParamMap: of(convertToParamMap(queryParams)) },
        },
      ],
    });
    TestBed.overrideComponent(Favorites, { set: { imports: [ListStub] } });

    const fixture = TestBed.createComponent(Favorites);
    fixture.detectChanges();
    return fixture;
  };

  it('uses favorite filter and disables add-only list actions', () => {
    const fixture = createFixture();
    const list = fixture.debugElement.query(By.directive(ListStub)).componentInstance as ListStub;

    const dataSource = list.dataSource() as (request: {
      offset: number;
      limit: number;
      orderBy: 'createdAt';
      orderDirection: 'desc';
    }) => unknown;
    dataSource({ offset: 0, limit: 50, orderBy: 'createdAt', orderDirection: 'desc' });

    expect(searchItems).toHaveBeenCalledWith(
      { favorite: true, listType: 'library', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
      50
    );
    expect(list.showAddButton()).toBe(false);
    expect(list.showAiSearchButton()).toBe(false);
    expect(list.showRandomPickButton()).toBe(false);
    expect(list.orderStorageKey()).toBe('favorites');
  });

  it('applies route filters while keeping favorite forced', () => {
    const fixture = createFixture({ type: 'movie', favorite: 'false', watched: 'false' });
    const list = fixture.debugElement.query(By.directive(ListStub)).componentInstance as ListStub;

    const dataSource = list.dataSource() as (request: {
      offset: number;
      limit: number;
      orderBy: 'createdAt';
      orderDirection: 'desc';
    }) => unknown;
    dataSource({ offset: 0, limit: 50, orderBy: 'createdAt', orderDirection: 'desc' });

    expect(searchItems).toHaveBeenCalledWith(
      {
        type: 'movie',
        watched: false,
        favorite: true,
        listType: 'library',
        orderBy: 'createdAt',
        orderDirection: 'desc',
      },
      0,
      50
    );
  });

  it('renders the favorites empty state', () => {
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Message.EmptyFavorites');
    expect(fixture.nativeElement.textContent).toContain('Message.AddFirstFavorite');
  });
});
