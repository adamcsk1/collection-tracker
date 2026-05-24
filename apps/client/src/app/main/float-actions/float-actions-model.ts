export interface FloatActionsConfig {
  collectionLength: number;
  scrollToTopAvailable: boolean;
  showActions: boolean;
  showAddButton: boolean;
  showAiSearchButton: boolean;
  showRandomPickButton: boolean;
  useAiSearch: boolean;
}

export interface FloatActionsCallbacks {
  addNew: () => void;
  randomPick: () => void;
  toggleAiSearch: () => void;
  scrollToTop: () => void;
  showFunctions: () => void;
}
