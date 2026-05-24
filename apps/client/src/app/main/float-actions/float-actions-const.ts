import { FloatActionsCallbacks, FloatActionsConfig } from './float-actions-model';

export const initialConfig: FloatActionsConfig = {
  collectionLength: 0,
  scrollToTopAvailable: false,
  showActions: false,
  showAddButton: true,
  showAiSearchButton: true,
  showRandomPickButton: true,
  useAiSearch: false,
};

export const noopCallbacks: FloatActionsCallbacks = {
  addNew: () => void 0,
  randomPick: () => void 0,
  toggleAiSearch: () => void 0,
  scrollToTop: () => void 0,
  showFunctions: () => void 0,
};
