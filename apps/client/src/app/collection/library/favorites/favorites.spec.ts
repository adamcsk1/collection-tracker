import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ApiService } from '@services/api/api-service';
import { FAVORITE_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it } from 'vitest';
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
  public readonly dataSource = input<unknown>();
}

describe('Favorites', () => {
  const createFixture = (): ComponentFixture<Favorites> => {
    TestBed.configureTestingModule({
      imports: [Favorites],
      providers: [
        { provide: ApiService, useValue: { searchItems: () => null } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    TestBed.overrideComponent(Favorites, { set: { imports: [ListStub] } });

    const fixture = TestBed.createComponent(Favorites);
    fixture.detectChanges();
    return fixture;
  };

  it('passes the favorite tag and disables add-only list actions', () => {
    const fixture = createFixture();
    const list = fixture.debugElement.query(By.directive(ListStub)).componentInstance as ListStub;

    expect(list.routeSearchText()).toBe(FAVORITE_TAG);
    expect(list.showAddButton()).toBe(false);
    expect(list.showAiSearchButton()).toBe(false);
    expect(list.showRandomPickButton()).toBe(false);
    expect(list.orderStorageKey()).toBe('favorites');
  });

  it('renders the favorites empty state', () => {
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Message.EmptyFavorites');
    expect(fixture.nativeElement.textContent).toContain('Message.AddFirstFavorite');
  });
});
