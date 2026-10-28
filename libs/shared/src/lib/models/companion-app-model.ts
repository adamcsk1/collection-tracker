export {};

declare global {
  interface CollectionTrackerBridge {
    showSettings?: () => void;
    resetAppConfig?: () => boolean;
    saveDownload?: (fileName: string, mimeType: string, base64Content: string) => boolean;
  }

  interface Window {
    CollectionTrackerInterface?: CollectionTrackerBridge;
    COLLECTION_TRACKER_CONFIG?: {
      pageUrl: string;
      apiUrl: string;
    };
  }
}
