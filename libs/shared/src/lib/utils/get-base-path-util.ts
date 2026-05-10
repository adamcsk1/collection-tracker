let cachedBasePath: string | undefined;

export const getBasePath = (): string => {
  if (cachedBasePath !== undefined) return cachedBasePath;

  try {
    const base = document.querySelector('base');
    if (!base) {
      cachedBasePath = '';
      return cachedBasePath;
    }

    const baseHref = base.getAttribute('href') || '/';
    // Remove trailing app segment (e.g. /collection-tracker/client/ -> /collection-tracker)
    const withoutTrailingSlash = baseHref.replace(/\/$/, '');
    const lastSegment = withoutTrailingSlash.split('/').pop();
    const appNames = ['client', 'login', 'health'];

    if (lastSegment && appNames.includes(lastSegment)) {
      cachedBasePath = withoutTrailingSlash.replace(new RegExp(`/${lastSegment}$`), '') || '';
    } else {
      cachedBasePath = withoutTrailingSlash;
    }

    return cachedBasePath;
  } catch {
    cachedBasePath = '';
    return cachedBasePath;
  }
};
