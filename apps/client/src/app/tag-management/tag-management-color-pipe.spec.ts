import { TestBed } from '@angular/core/testing';
import { initialTagManagementState, TagManagementState, tagManagementStateToken } from './tag-management-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagManagementColorPipe } from './tag-management-color-pipe';

describe('TagManagementColorPipe', () => {
  let pipe: TagManagementColorPipe;
  let tagManagementState: NgxSimpleSignalStoreService<TagManagementState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TagManagementColorPipe, provideStore(initialTagManagementState, tagManagementStateToken)],
    });

    pipe = TestBed.inject(TagManagementColorPipe);
    tagManagementState = TestBed.inject(tagManagementStateToken);
  });

  it('returns matching tag color by default', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: '#112233',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
    ]);

    expect(pipe.transform('#blue')).toBe('#112233');
  });

  it('respects image border/text usage flags and ignores non-compatible entries', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: '#112233',
        useForImageBorder: false,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#red',
        color: '#ff0000',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#gray',
        color: 'transparent',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
    ]);

    expect(pipe.transform('#blue', { checkUseForImageBorder: true })).toBeNull();
    expect(pipe.transform('#blue', { checkUseForTextColor: true })).toBe('#112233');
    expect(pipe.transform('#red', { checkUseForTextColor: true })).toBeNull();
    expect(pipe.transform('#red', { checkUseForImageBorder: true })).toBe('#ff0000');
  });

  it('supports tag arrays and still respects flags', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: '#112233',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#orange',
        color: '#ffaa00',
        useForImageBorder: false,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 2,
      },
    ]);

    expect(pipe.transform(['#missing', '#orange'], { checkUseForTextColor: true })).toBe('#ffaa00');
    expect(pipe.transform(['#missing', '#orange'], { checkUseForImageBorder: true })).toBeNull();
  });

  it('returns null when color is transparent', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: 'transparent',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
    ]);

    expect(pipe.transform('#blue')).toBeNull();
  });

  it('supports image badge flag and ignores non-badge configs', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#badge',
        color: '#112233',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#image-badge',
        color: '#fefefe',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
      {
        tag: '#transparent-badge',
        color: 'transparent',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
    ]);

    expect(pipe.transform('#badge', { useForImageBadge: true })).toBeNull();
    expect(pipe.transform('#image-badge', { useForImageBadge: true })).toBe('#fefefe');
    expect(pipe.transform(['#badge', '#image-badge'], { useForImageBadge: true })).toBe('#fefefe');
    expect(pipe.transform(['#badge', '#transparent-badge'], { useForImageBadge: true })).toBeNull();
  });
});
