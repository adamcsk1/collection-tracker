export const prefersCoarsePointer = () => window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

export const getCoarsePointerBasedDebounceTime = () => (prefersCoarsePointer() ? 700 : 500);
