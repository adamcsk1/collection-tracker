import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyMdeInstance } from './markdown-editor-model';

type MockCodeMirrorEvent = 'change' | 'blur';
type MockCodeMirrorMethods = {
  on: ((event: MockCodeMirrorEvent, callback: () => void) => void) & ReturnType<typeof vi.fn>;
  setSize: ((width: number | string | null, height: number | string | null) => void) & ReturnType<typeof vi.fn>;
  setOption: ((option: string, value: unknown) => void) & ReturnType<typeof vi.fn>;
  refresh: (() => void) & ReturnType<typeof vi.fn>;
};

type MockEasyMdeInitializationOptions = {
  toolbar: boolean;
  autoDownloadFontAwesome: boolean;
  autofocus: boolean;
  element: HTMLElement;
  initialValue: string;
  spellChecker: boolean;
  status: boolean;
};

type MarkdownEditorComponentType = (typeof import('./markdown-editor'))['MarkdownEditor'];
type MarkdownEditorComponentInstance = InstanceType<MarkdownEditorComponentType>;

class MockEasyMde implements EasyMdeInstance {
  public static constructorCalls = 0;
  public static lastCreatedInstance: MockEasyMde | null = null;
  public readonly initializationOptions: MockEasyMdeInitializationOptions;

  public static reset(): void {
    MockEasyMde.constructorCalls = 0;
    MockEasyMde.lastCreatedInstance = null;
  }

  public readonly codemirror: {
    on: MockCodeMirrorMethods['on'];
    setSize: MockCodeMirrorMethods['setSize'];
    setOption: MockCodeMirrorMethods['setOption'];
    refresh: MockCodeMirrorMethods['refresh'];
  };

  public readonly togglePreview = vi.fn();
  public readonly toTextArea = vi.fn();
  public readonly cleanup = vi.fn();
  public readonly value = vi.fn((newValue?: string): string | void => {
    if (typeof newValue === 'string') {
      this.currentValue = newValue;
      return;
    }

    return this.currentValue;
  });
  public readonly isPreviewActive = vi.fn(() => this.previewActive);

  private currentValue: string;
  private previewActive = false;
  private readonly eventCallbacks: Partial<Record<MockCodeMirrorEvent, () => void>> = {};

  public constructor(_initializationOptions: MockEasyMdeInitializationOptions) {
    this.initializationOptions = _initializationOptions;
    this.currentValue = _initializationOptions.initialValue;
    this.codemirror = {
      on: vi.fn((event: MockCodeMirrorEvent, callback: () => void) => {
        this.eventCallbacks[event] = callback;
      }) as MockCodeMirrorMethods['on'],
      setSize: vi.fn() as MockCodeMirrorMethods['setSize'],
      setOption: vi.fn() as MockCodeMirrorMethods['setOption'],
      refresh: vi.fn() as MockCodeMirrorMethods['refresh'],
    };

    MockEasyMde.constructorCalls += 1;
    MockEasyMde.lastCreatedInstance = this;
  }

  public triggerChange(): void {
    this.eventCallbacks.change?.();
  }

  public triggerBlur(): void {
    this.eventCallbacks.blur?.();
  }

  public setPreviewActive(value: boolean): void {
    this.previewActive = value;
  }

  public setCurrentValue(value: string): void {
    this.currentValue = value;
  }
}

const getLastCreatedMockEasyMde = (): MockEasyMde => {
  if (!MockEasyMde.lastCreatedInstance) {
    throw new Error('The markdown editor instance is not available in the current test setup');
  }

  return MockEasyMde.lastCreatedInstance;
};

describe('MarkdownEditor component', () => {
  let fixture: ComponentFixture<MarkdownEditorComponentInstance>;
  let component: MarkdownEditorComponentInstance;
  let markdownEditorComponentType: MarkdownEditorComponentType;

  beforeEach(async () => {
    MockEasyMde.reset();
    vi.resetAllMocks();
    vi.resetModules();
    TestBed.resetTestingModule();
    vi.doMock('easymde', () => ({
      __esModule: true,
      default: MockEasyMde,
    }));
    const markdownEditorModule = await import('./markdown-editor');
    markdownEditorComponentType = markdownEditorModule.MarkdownEditor;

    TestBed.configureTestingModule({
      imports: [markdownEditorComponentType],
    });

    fixture = TestBed.createComponent(markdownEditorComponentType);
    fixture.componentRef.setInput('editMode', true);
    fixture.componentRef.setInput('autoHeight', false);
    fixture.componentRef.setInput('value', 'initial content');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 110));
    await fixture.whenStable();
    document.body.appendChild(fixture.nativeElement);

    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document.querySelectorAll('.CodeMirror').forEach((element) => element.remove());
  });

  it('creates the editor instance with expected EasyMDE options and registers both change and blur handlers', () => {
    const markdownEditor = getLastCreatedMockEasyMde();
    const editorInitializationOptions = markdownEditor.initializationOptions;

    expect(MockEasyMde.constructorCalls).toBe(1);
    expect(editorInitializationOptions?.toolbar).toBe(false);
    expect(editorInitializationOptions?.autoDownloadFontAwesome).toBe(false);
    expect(editorInitializationOptions?.autofocus).toBe(true);
    expect(editorInitializationOptions?.initialValue).toBe('initial content');
    expect(editorInitializationOptions?.spellChecker).toBe(false);
    expect(editorInitializationOptions?.status).toBe(false);
    expect(markdownEditor.codemirror.on).toHaveBeenCalledWith('change', expect.any(Function));
    expect(markdownEditor.codemirror.on).toHaveBeenCalledWith('blur', expect.any(Function));
  });

  it('writes updated editor text into value model when the editor emits change callback', () => {
    const markdownEditor = getLastCreatedMockEasyMde();

    markdownEditor.setCurrentValue('updated content');
    markdownEditor.triggerChange();

    expect(component.value()).toBe('updated content');
  });

  it('marks the editor as touched when the editor emits blur callback', () => {
    const markdownEditor = getLastCreatedMockEasyMde();

    expect(component.touched()).toBe(false);

    markdownEditor.triggerBlur();

    expect(component.touched()).toBe(true);
  });

  it('activates preview mode when edit mode is disabled and the editor is not already in preview state', () => {
    const markdownEditor = getLastCreatedMockEasyMde();
    markdownEditor.setPreviewActive(false);

    fixture.componentRef.setInput('editMode', false);
    fixture.detectChanges();

    expect(markdownEditor.togglePreview).toHaveBeenCalledTimes(1);
    expect(markdownEditor.codemirror.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not activate preview mode when edit mode and editor preview state already match', () => {
    const markdownEditor = getLastCreatedMockEasyMde();
    markdownEditor.setPreviewActive(false);
    (markdownEditor.togglePreview as ReturnType<typeof vi.fn>).mockClear();
    (markdownEditor.codemirror.refresh as ReturnType<typeof vi.fn>).mockClear();

    component['togglePreview']();

    expect(markdownEditor.togglePreview).not.toHaveBeenCalled();
    expect(markdownEditor.codemirror.refresh).not.toHaveBeenCalled();
  });

  it('updates read-only option when disabled input toggles to true and skips duplicates for unchanged state', () => {
    const markdownEditor = getLastCreatedMockEasyMde();
    const setOptionSpy = vi.spyOn(markdownEditor.codemirror, 'setOption');

    fixture.componentRef.setInput('disabled', true);
    component['updateEditorDisabledState']();

    expect(setOptionSpy).toHaveBeenCalledWith('readOnly', false);
    expect(setOptionSpy).toHaveBeenCalledWith('readOnly', 'nocursor');

    fixture.componentRef.setInput('disabled', true);
    component['updateEditorDisabledState']();

    expect(setOptionSpy).toHaveBeenCalledTimes(2);
  });

  it('sets CodeMirror wrapper height when auto-height refresh is requested', async () => {
    const markdownWrapper = document.createElement('div');
    markdownWrapper.className = 'CodeMirror';
    const hostElement = component['elementRef'].nativeElement as HTMLElement;
    const hostParentElement = document.createElement('div');

    Object.defineProperty(hostParentElement, 'clientHeight', {
      configurable: true,
      get: () => 120,
    });

    Object.defineProperty(hostElement, 'parentElement', {
      configurable: true,
      value: hostParentElement,
      writable: true,
    });

    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue(markdownWrapper);
    const setStyleSpy = vi.spyOn(component['renderer'], 'setStyle');

    component['setFullHeight']();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setStyleSpy).toHaveBeenCalledWith(markdownWrapper, 'height', '104px');
    querySelectorSpy.mockRestore();
  });

  it('sets loaded signal to true when editor loading delay has elapsed', async () => {
    await new Promise((resolve) => setTimeout(resolve, 110));
    expect(component['easyMdeLoaded']()).toBe(true);
  });

  it('removes editor resources on destroy by invoking toTextArea and cleanup methods', () => {
    const markdownEditor = getLastCreatedMockEasyMde();
    const toTextAreaSpy = vi.spyOn(markdownEditor, 'toTextArea');
    const cleanupSpy = vi.spyOn(markdownEditor, 'cleanup');

    fixture.destroy();

    expect(toTextAreaSpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
