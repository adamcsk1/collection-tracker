import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionButtonsService } from './float-action-buttons-service';

describe('FloatActionButtonsService', () => {
  let service: FloatActionButtonsService;

  beforeEach(() => {
    service = new FloatActionButtonsService();
  });

  it('merges partial config updates', () => {
    service.updateConfig({ showActions: true, collectionLength: 5 });
    service.updateConfig({ showAiSearchButton: false });

    expect(service.config()).toEqual({
      collectionLength: 5,
      showActions: true,
      showAddButton: true,
      showAiSearchButton: false,
      showRandomPickButton: true,
      showOrderButtons: false,
      filterActions: [],
      activeFilterActions: [],
      useAiSearch: false,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
  });

  it('dispatches registered callbacks', () => {
    const callbacks = {
      addNew: vi.fn(),
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    };
    service.setCallbacks(callbacks);

    service.addNew();
    service.randomPick();
    service.toggleAiSearch();
    service.toggleOrderBy();
    service.toggleOrderDirection();
    service.applyFilter('movie');
    service.showFunctions();

    expect(callbacks.addNew).toHaveBeenCalledTimes(1);
    expect(callbacks.randomPick).toHaveBeenCalledTimes(1);
    expect(callbacks.toggleAiSearch).toHaveBeenCalledTimes(1);
    expect(callbacks.toggleOrderBy).toHaveBeenCalledTimes(1);
    expect(callbacks.toggleOrderDirection).toHaveBeenCalledTimes(1);
    expect(callbacks.applyFilter).toHaveBeenCalledWith('movie');
    expect(callbacks.showFunctions).toHaveBeenCalledTimes(1);
  });

  it('resets config and callbacks', () => {
    const addNew = vi.fn();
    service.updateConfig({ showActions: true, collectionLength: 5 });
    service.setCallbacks({
      addNew,
      randomPick: vi.fn(),
      toggleAiSearch: vi.fn(),
      toggleOrderBy: vi.fn(),
      toggleOrderDirection: vi.fn(),
      applyFilter: vi.fn(),
      showFunctions: vi.fn(),
    });

    service.reset();
    service.addNew();

    expect(service.config()).toEqual({
      collectionLength: 0,
      showActions: false,
      showAddButton: true,
      showAiSearchButton: true,
      showRandomPickButton: true,
      showOrderButtons: false,
      filterActions: [],
      activeFilterActions: [],
      useAiSearch: false,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
    expect(addNew).not.toHaveBeenCalled();
  });
});
