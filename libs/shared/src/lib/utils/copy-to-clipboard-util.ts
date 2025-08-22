import { mobileUserAgent } from '@shared/utils/mobile-user-ageint.util';

type WindowExtended = Window & { clipboardData?: { setData: (format: string, data: string) => void } };

export const copyToClipboard = (text: string) => {
  if (mobileUserAgent()) {
    if ((window as WindowExtended)?.clipboardData?.setData) {
      (window as WindowExtended)!.clipboardData!.setData('Text', text);
    } else if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
      const textarea = document.createElement('textarea');
      textarea.textContent = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
      } catch {
        navigator.clipboard.writeText(text);
      } finally {
        document.body.removeChild(textarea);
      }
    } else navigator.clipboard.writeText(text);
  } else navigator.clipboard.writeText(text);
};
