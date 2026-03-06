export type EasyMdeInstance = {
  togglePreview(): void;
  isPreviewActive(): boolean;
  value: (val?: string) => string | void;
  codemirror: {
    on: (event: 'change' | 'blur', callback: () => void) => void;
    setSize: (width: number | string | null, height: number | string | null) => void;
    setOption: (option: string, value: unknown) => void;
    refresh: () => void;
  };
  toTextArea: () => void;
  cleanup: () => void;
};

export type EasyMdeCtor = new (options: {
  element: HTMLElement;
  initialValue: string;
  spellChecker: boolean;
  status: boolean;
  autoDownloadFontAwesome: boolean;
  autofocus: boolean;
  toolbar: boolean;
}) => EasyMdeInstance;
