import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MenuDialog } from './menu-dialog';

describe('MenuDialog', () => {
  let fixture: ComponentFixture<MenuDialog>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MenuDialog],
    });

    TestBed.overrideComponent(MenuDialog, {
      set: {
        template: '',
      },
    });
  });

  it('creates', () => {
    fixture = TestBed.createComponent(MenuDialog);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
