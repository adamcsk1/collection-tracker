import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Collection } from './collection';

describe('Collection component', () => {
  let fixture: ComponentFixture<Collection>;

  const createFixture = () => {
    TestBed.configureTestingModule({
      imports: [Collection],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(Collection);
    fixture.detectChanges();
  };

  beforeEach(() => {
    createFixture();
  });

  it('renders a router outlet for collection child routes', () => {
    expect(fixture.debugElement.query((debugElement) => !!debugElement.injector.get(RouterOutlet, null))).toBeTruthy();
  });
});
