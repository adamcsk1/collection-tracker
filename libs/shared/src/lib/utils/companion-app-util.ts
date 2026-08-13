import type {} from '../models/companion-app-model';

export const companionApp = () => !!window.CollectionTrackerInterface;

export const resetCompanionAppConfig = () => {
  return window.CollectionTrackerInterface?.resetAppConfig?.();
};

export const saveCompanionAppDownload = (fileName: string, mimeType: string, content: string): boolean => {
  const saveDownload = window.CollectionTrackerInterface?.saveDownload;
  if (!saveDownload) return false;

  try {
    return saveDownload(fileName, mimeType, encodeBase64Content(content));
  } catch {
    return false;
  }
};

const encodeBase64Content = (content: string): string => {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(content);
    let binaryContent = '';
    for (const byte of bytes) {
      binaryContent += String.fromCharCode(byte);
    }

    return btoa(binaryContent);
  }

  return btoa(unescape(encodeURIComponent(content)));
};
