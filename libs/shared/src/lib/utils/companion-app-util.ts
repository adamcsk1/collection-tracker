declare global {
  interface CollectionTrackerBridge {
    resetAppConfig?: () => boolean;
  }

  interface Window {
    CollectionTrackerInterface?: CollectionTrackerBridge;
    COLLECTION_TRACKER_CONFIG?: {
      pageUrl: string;
      apiUrl: string;
    };
  }
}

export const companionApp = () => !!window.CollectionTrackerInterface;

export const resetCompanionAppConfig = () => {
  return window.CollectionTrackerInterface?.resetAppConfig?.();
};
