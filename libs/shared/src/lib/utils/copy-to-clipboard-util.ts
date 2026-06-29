import { mobileUserAgent } from './mobile-user-agent.util';
import { WindowExtended } from './copy-to-clipboard-model';

export const copyToClipboard = (text: string) => {
  const extendedWindow: WindowExtended = window;

  if (mobileUserAgent()) {
    if (extendedWindow.clipboardData?.setData) {
      extendedWindow.clipboardData.setData('Text', text);
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
