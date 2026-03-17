import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagConfigsService } from './tag-configs-service';
import { initialTagConfigsState, TagConfigsState, tagConfigsStateToken } from './tag-configs-store';

describe('TagConfigsService', () => {
  let service: TagConfigsService;
  let api: {
    getUserTagConfigs: ReturnType<typeof vi.fn>;
    updateUserTagConfigs: ReturnType<typeof vi.fn>;
  };
  let tagConfigsState: NgxSimpleSignalStoreService<TagConfigsState>;

  beforeEach(() => {
    api = {
      getUserTagConfigs: vi.fn(() =>
        of([
          {
            tag: '#low',
            color: '#111111',
            useForImageBorder: false,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 1,
          },
          {
            tag: '#high',
            color: '#222222',
            useForImageBorder: true,
            useForTextColor: false,
            useForImageBadge: false,
            weight: 9,
          },
        ])
      ),
      updateUserTagConfigs: vi.fn(() => of(void 0)),
    };

    TestBed.configureTestingModule({
      providers: [
        TagConfigsService,
        { provide: ApiService, useValue: api },
        provideStore(initialTagConfigsState, tagConfigsStateToken),
      ],
    });

    service = TestBed.inject(TagConfigsService);
    tagConfigsState = TestBed.inject(tagConfigsStateToken);
  });

  it('preloads user configs and stores them sorted by weight', () => {
    service.preloadUserTagConfigs().subscribe();

    expect(api.getUserTagConfigs).toHaveBeenCalled();
    expect(tagConfigsState.state.configs()).toEqual([
      {
        tag: '#high',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 9,
      },
      {
        tag: '#low',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
  });

  it('syncs sorted configs to API and updates state', () => {
    const input = [
      {
        tag: '#low',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#high',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 9,
      },
    ];

    service.syncUserTagConfigs(input).subscribe();

    expect(api.updateUserTagConfigs).toHaveBeenCalledWith([
      {
        tag: '#high',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 9,
      },
      {
        tag: '#low',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
    expect(tagConfigsState.state.configs()).toEqual([
      {
        tag: '#high',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 9,
      },
      {
        tag: '#low',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
  });

  it('falls back to zero weight when sorting malformed configs', () => {
    const malformedInput = [
      {
        tag: '#missing-weight',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      } as any,
      {
        tag: '#weighted',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 3,
      },
    ];

    service.syncUserTagConfigs(malformedInput).subscribe();

    expect(api.updateUserTagConfigs).toHaveBeenCalledWith([
      {
        tag: '#weighted',
        color: '#222222',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 3,
      },
      {
        tag: '#missing-weight',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      },
    ]);
  });

  it('keeps order stable when all weights are missing', () => {
    const malformedInput = [
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      } as any,
      {
        tag: '#b',
        color: '#222222',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      } as any,
    ];

    service.syncUserTagConfigs(malformedInput).subscribe();

    expect(api.updateUserTagConfigs).toHaveBeenCalledWith([
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      },
      {
        tag: '#b',
        color: '#222222',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
      },
    ]);
  });
});
