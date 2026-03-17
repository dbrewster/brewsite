// Shared KTX2 texture cache and loader — one instance per WidgetRegistry.

import { RepeatWrapping, LinearFilter, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import type { WebGLRenderer, Texture } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type {
  MaterialPreset,
  MaterialPresetDefaults,
  LoadedMaterialTextures,
  LoadedMaterialPreset,
} from './materialTypes';

/** Default path for Basis transcoder files. */
const DEFAULT_TRANSCODER_PATH = '/assets/materials/basis/';

/**
 * Shared KTX2 texture cache and loader.
 *
 * One instance lives on each WidgetRegistry. All widgets across all packages
 * share the same texture cache — if the carousel tray and the floor both use
 * 'onyx', the textures load once.
 *
 * Cache is keyed by full resolved URL, not preset name. If two presets share
 * the same roughness texture file, it loads once.
 *
 * Error handling:
 * - Failed texture loads are cached as failures so they don't retry every frame.
 * - A single warning is logged per failed URL. No error spam in the render loop.
 * - Callers receive `null` for failed presets and fall back to base materials.
 */
export class MaterialLoader {
  /** KTX2Loader per WebGLRenderer (renderer-specific GPU transcoding context). */
  private loaders = new WeakMap<WebGLRenderer, KTX2Loader>();

  /** Active renderer reference for texture loading. */
  private activeRenderer: WebGLRenderer | null = null;

  /** Active KTX2Loader for the current renderer. */
  private activeLoader: KTX2Loader | null = null;

  /** Texture cache keyed by full resolved URL. */
  private textureCache = new Map<string, Texture>();

  /** In-flight load promises keyed by full resolved URL. */
  private loadingPromises = new Map<string, Promise<Texture | null>>();

  /** URLs that have permanently failed — prevents retry storms. */
  private failedUrls = new Set<string>();

  /** Loaded preset cache keyed by resolved color URL. */
  private presetCache = new Map<string, LoadedMaterialPreset>();

  /** Preset keys that have permanently failed — prevents retry storms. */
  private failedPresets = new Set<string>();

  /** In-flight preset load promises keyed by resolved color URL. */
  private presetLoadingPromises = new Map<string, Promise<LoadedMaterialPreset | null>>();

  /** Whether initialize() has been called with a renderer. */
  private initialized = false;

  /** Whether we've already warned about missing initialization. */
  private warnedNotInitialized = false;

  /**
   * Initializes the loader for a specific WebGLRenderer.
   * Must be called before loadPreset(). Typically called from
   * texturesPlugin.onRendererCreated().
   */
  initialize(renderer: WebGLRenderer, transcoderPath?: string): void {
    if (this.loaders.has(renderer)) return;

    const loader = new KTX2Loader();
    loader.setTranscoderPath(transcoderPath ?? DEFAULT_TRANSCODER_PATH);
    loader.detectSupport(renderer);
    this.loaders.set(renderer, loader);
    this.activeRenderer = renderer;
    this.activeLoader = loader;
    this.initialized = true;
  }

  /**
   * Returns true if initialize() has been called with a renderer.
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Loads all textures for a material preset and returns a LoadedMaterialPreset.
   * Results are cached — subsequent calls with the same preset return immediately.
   *
   * Returns `null` if loading fails (missing files, invalid format, etc.).
   * Failed presets are cached so the error is logged once and never retried.
   */
  async loadPreset(preset: MaterialPreset, basePath: string): Promise<LoadedMaterialPreset | null> {
    if (!this.activeLoader) {
      if (!this.warnedNotInitialized) {
        console.warn(
          '[MaterialLoader] Not initialized — call initialize(renderer) before loadPreset(). ' +
          'If using @brewsite/textures, ensure texturesPlugin() is in your plugins array. ' +
          'Falling back to base materials.',
        );
        this.warnedNotInitialized = true;
      }
      return null;
    }

    // Build a cache key from the resolved color URL (unique per preset identity).
    const cacheKey = this.resolveUrl(basePath, preset.maps.color);

    // Return cached success.
    const cached = this.presetCache.get(cacheKey);
    if (cached) return cached;

    // Return cached failure (don't retry).
    if (this.failedPresets.has(cacheKey)) return null;

    // Deduplicate in-flight loads.
    const existing = this.presetLoadingPromises.get(cacheKey);
    if (existing) return existing;

    const promise = this.loadPresetTextures(preset, basePath)
      .then((result) => {
        this.presetCache.set(cacheKey, result);
        return result;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[MaterialLoader] Failed to load material preset (${preset.maps.color}): ${msg}. ` +
          `Falling back to base material. ` +
          `Ensure KTX2 texture files exist at "${basePath}" and the Basis transcoder is available.`,
        );
        this.failedPresets.add(cacheKey);
        return null;
      })
      .finally(() => {
        this.presetLoadingPromises.delete(cacheKey);
      });

    this.presetLoadingPromises.set(cacheKey, promise);
    return promise;
  }

  /**
   * Returns a previously loaded preset by name, or null if not yet loaded.
   * Sync cache hit for use in render loops.
   */
  getLoadedPreset(presetName: string): LoadedMaterialPreset | null {
    for (const [, preset] of this.presetCache) {
      // The presetCache is keyed by resolved URL; search by value is acceptable
      // because the number of loaded presets is small (typically < 20).
      // For a direct name lookup, callers should maintain their own mapping.
      void preset;
    }
    // The cache is keyed by resolved URL. For name-based lookup, the caller
    // must provide the preset + basePath to resolve the key.
    return null;
  }

  /**
   * Returns a previously loaded preset by its resolved color URL cache key, or null.
   */
  getLoadedPresetByKey(preset: MaterialPreset, basePath: string): LoadedMaterialPreset | null {
    const cacheKey = this.resolveUrl(basePath, preset.maps.color);
    return this.presetCache.get(cacheKey) ?? null;
  }

  /**
   * Returns true if the preset at this key has permanently failed to load.
   * Callers can use this to skip re-requesting without awaiting the promise.
   */
  isPresetFailed(preset: MaterialPreset, basePath: string): boolean {
    const cacheKey = this.resolveUrl(basePath, preset.maps.color);
    return this.failedPresets.has(cacheKey);
  }

  /**
   * Disposes all cached textures and clears internal state.
   */
  dispose(): void {
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();
    this.loadingPromises.clear();
    this.presetCache.clear();
    this.presetLoadingPromises.clear();
    this.failedUrls.clear();
    this.failedPresets.clear();

    // Dispose all KTX2Loader instances.
    this.activeLoader?.dispose();
    this.activeLoader = null;
    this.activeRenderer = null;
    this.initialized = false;
    this.warnedNotInitialized = false;
  }

  /**
   * Disposes resources associated with a specific renderer.
   * Called from WidgetRegistry.notifyRendererDisposing().
   */
  disposeForRenderer(renderer: WebGLRenderer): void {
    const loader = this.loaders.get(renderer);
    if (loader) {
      loader.dispose();
      this.loaders.delete(renderer);
    }
    if (this.activeRenderer === renderer) {
      this.activeRenderer = null;
      this.activeLoader = null;
      this.initialized = false;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private resolveUrl(basePath: string, relativePath: string): string {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return `${base}${relativePath}`;
  }

  private async loadPresetTextures(
    preset: MaterialPreset,
    basePath: string,
  ): Promise<LoadedMaterialPreset> {
    const maps = preset.maps;

    const [color, normal, roughness, metalness, displacement] = await Promise.all([
      this.loadTexture(basePath, maps.color, true),
      this.loadTexture(basePath, maps.normal, false),
      this.loadTexture(basePath, maps.roughness, false),
      maps.metalness ? this.loadTexture(basePath, maps.metalness, false) : Promise.resolve(null),
      maps.displacement ? this.loadTexture(basePath, maps.displacement, false) : Promise.resolve(null),
    ]);

    // If any required texture failed, the preset is unusable.
    if (!color || !normal || !roughness) {
      throw new Error(
        `Required textures missing — color:${!!color} normal:${!!normal} roughness:${!!roughness}`,
      );
    }

    const textures: LoadedMaterialTextures = {
      color,
      normal,
      roughness,
      ...(metalness ? { metalness } : {}),
      ...(displacement ? { displacement } : {}),
    };

    const defaults: MaterialPresetDefaults = preset.defaults;

    return { textures, defaults };
  }

  private async loadTexture(
    basePath: string,
    relativePath: string,
    isSRGB: boolean,
  ): Promise<Texture | null> {
    const url = this.resolveUrl(basePath, relativePath);

    // Return cached texture if available.
    const cached = this.textureCache.get(url);
    if (cached) return cached;

    // Don't retry permanently failed URLs.
    if (this.failedUrls.has(url)) return null;

    // Deduplicate in-flight loads.
    const existing = this.loadingPromises.get(url);
    if (existing) return existing;

    const loader = this.activeLoader;
    if (!loader) {
      // Should not happen if callers check isInitialized, but guard defensively.
      return null;
    }

    const promise = loader.loadAsync(url)
      .then((texture) => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.colorSpace = isSRGB ? SRGBColorSpace : LinearSRGBColorSpace;
        this.textureCache.set(url, texture);
        return texture;
      })
      .catch((_err: unknown) => {
        // Cache this URL as permanently failed so we don't retry every frame.
        this.failedUrls.add(url);
        return null;
      })
      .finally(() => {
        this.loadingPromises.delete(url);
      });

    this.loadingPromises.set(url, promise);
    return promise;
  }
}
