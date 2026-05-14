import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
  public readonly routeSearchText = input('');
}

describe('Favorites', () => {
  const createFixture = (): ComponentFixture<Favorites> => {
    TestBed.configureTestingModule({
      imports: [Favorites],
      providers: [{ provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } }],
    });
    TestBed.overrideComponent(Favorites, { set: { imports: [ListStub] } });

    const fixture = TestBed.createComponent(Favorites);
    fixture.detectChanges();
    return fixture;
  };

  it('passes the favorite tag and hides list actions', () => {
    const fixture = createFixture();
    const list = fixture.debugElement.query(By.directive(ListStub)).componentInstance as ListStub;

    expect(list.routeSearchText()).toBe(FAVORITE_TAG);
    expect(list.hideFloatActions()).toBe(true);
  });

  it('renders the favorites empty state', () => {
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Message.EmptyFavorites');
    expect(fixture.nativeElement.textContent).toContain('Message.AddFirstFavorite');
  });
});
