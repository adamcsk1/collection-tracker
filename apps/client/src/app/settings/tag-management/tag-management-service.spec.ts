import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagManagementService } from './tag-management-service';
import {
  initialTagManagementState,
  tagManagementStateToken,
  type TagManagementState,
} from '../../tag-management/tag-management-store';

describe('TagManagementService', () => {
  let service: TagManagementService;
  let api: {
    getUserTagManagement: ReturnType<typeof vi.fn>;
    updateUserTagManagement: ReturnType<typeof vi.fn>;
    renameTag: ReturnType<typeof vi.fn>;
  };
  let tagManagementState: NgxSimpleSignalStoreService<TagManagementState>;

  beforeEach(() => {
    api = {
      getUserTagManagement: vi.fn(() =>
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
      updateUserTagManagement: vi.fn((configs: unknown) => of(configs)),
      renameTag: vi.fn(() =>
        of({
          renamedItemCount: 1,
          tagManagement: [
            {
              tag: '#renamed',
              color: '#333333',
              useForImageBorder: false,
              useForTextColor: true,
              useForImageBadge: false,
              weight: 5,
            },
          ],
        })
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        TagManagementService,
        { provide: ApiService, useValue: api },
        provideStore(initialTagManagementState, tagManagementStateToken),
      ],
    });

    service = TestBed.inject(TagManagementService);
    tagManagementState = TestBed.inject(tagManagementStateToken);
  });

  it('preloads user configs and stores them sorted by weight', () => {
    service.preloadUserTagManagement().subscribe();

    expect(api.getUserTagManagement).toHaveBeenCalled();
    expect(tagManagementState.state.configs()).toEqual([
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

    service.syncUserTagManagement(input).subscribe();

    expect(api.updateUserTagManagement).toHaveBeenCalledWith([
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
    expect(tagManagementState.state.configs()).toEqual([
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

    service.syncUserTagManagement(malformedInput).subscribe();

    expect(api.updateUserTagManagement).toHaveBeenCalledWith([
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

    service.syncUserTagManagement(malformedInput).subscribe();

    expect(api.updateUserTagManagement).toHaveBeenCalledWith([
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

  it('renames a tag, returns the API result, and stores returned configs sorted by weight', () => {
    let renamedItemCount = 0;

    service.renameTag('#old', '#renamed').subscribe((response) => {
      renamedItemCount = response.renamedItemCount;
    });

    expect(api.renameTag).toHaveBeenCalledWith('#old', '#renamed');
    expect(renamedItemCount).toBe(1);
    expect(tagManagementState.state.configs()).toEqual([
      {
        tag: '#renamed',
        color: '#333333',
        useForImageBorder: false,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 5,
      },
    ]);
  });

  it('does not update stored configs when no owned items were renamed', () => {
    const initialConfigs = [
      {
        tag: '#old',
        color: '#111111',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ];
    tagManagementState.setState('configs', initialConfigs);
    api.renameTag.mockReturnValueOnce(of({ renamedItemCount: 0, tagManagement: [] }));

    service.renameTag('#old', '#new').subscribe();

    expect(tagManagementState.state.configs()).toEqual(initialConfigs);
  });
});
