export interface MessageDialogOptions {
  title?: string;
  actionLabel?: string;
}

export type ConfirmDialogOptions = MessageDialogOptions &
  ({ destructive?: false } | { destructive: true; confirmationText: string });

export interface MessageDialogRequest {
  message: string;
  mode: 'alert' | 'info' | 'confirm';
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}
