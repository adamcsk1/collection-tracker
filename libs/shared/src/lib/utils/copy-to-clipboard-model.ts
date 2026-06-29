export type WindowExtended = Window & { clipboardData?: { setData: (format: string, data: string) => void } };
