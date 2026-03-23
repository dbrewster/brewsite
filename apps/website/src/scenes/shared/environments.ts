// HDR environment descriptors for website scenes.

/** Available HDR environment keys for the website. */
export type WebsiteEnvironmentKey =
  | 'heroChamber'
  | 'warmAtrium'
  | 'systemsObservatory';

/**
 * Descriptor for an HDR environment asset.
 * Used to configure the Environment DSL component in scene files.
 */
export type WebsiteEnvironmentSpec = {
  readonly key: WebsiteEnvironmentKey;
  readonly url: string;
  readonly fallbackColor: string;
};

/** HDR environment descriptors keyed by WebsiteEnvironmentKey. */
export const websiteEnvironments: Record<WebsiteEnvironmentKey, WebsiteEnvironmentSpec> = {
  heroChamber: {
    key: 'heroChamber',
    url: '/environments/hero-chamber.hdr',
    fallbackColor: '#050a12',
  },
  warmAtrium: {
    key: 'warmAtrium',
    url: '/environments/warm-atrium.hdr',
    fallbackColor: '#0a0e18',
  },
  systemsObservatory: {
    key: 'systemsObservatory',
    url: '/environments/systems-observatory.hdr',
    fallbackColor: '#060c16',
  },
};
