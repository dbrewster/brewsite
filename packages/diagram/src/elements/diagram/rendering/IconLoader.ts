// Async SVG/raster icon loader with module-level cache.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { SvgIcon3DStyle } from '../types';
import { buildSvgIcon3D } from '../shapes/svgIcon3D';

export interface IIconLoader {
  load(
    url: string,
    width: number,
    height: number,
    style: SvgIcon3DStyle,
    maxDepth: number,
    metalness: number,
    roughness: number,
  ): Promise<THREE.Object3D>;
  disposeAll(): void;
}

class IconLoaderImpl implements IIconLoader {
  private readonly cache = new Map<string, Promise<THREE.Object3D>>();
  private readonly svgLoader = new SVGLoader();
  private readonly textureLoader = new THREE.TextureLoader();

  load(
    url: string,
    width: number,
    height: number,
    style: SvgIcon3DStyle,
    maxDepth: number,
    metalness: number,
    roughness: number,
  ): Promise<THREE.Object3D> {
    const cacheKey = `${url}|${width}|${height}|${style}|${maxDepth}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const promise = new Promise<THREE.Object3D>((resolve) => {
      if (url.toLowerCase().endsWith('.svg')) {
        if (style !== 'flat') {
          this.svgLoader.load(
            url,
            (data) => {
              resolve(buildSvgIcon3D(data, { width, height, maxDepth, style, metalness, roughness }));
            },
            undefined,
            (err) => {
              console.warn(`[DiagramRenderer] Failed to load 3D SVG icon: ${url}`, err);
              this.cache.delete(cacheKey);
              resolve(new THREE.Group());
            },
          );
        } else {
          this.svgLoader.load(
            url,
            (data) => {
              const group = new THREE.Group();
              const paths = data.paths ?? [];
              paths.forEach((path) => {
                const s = (path.userData as { style?: { fill?: string } } | undefined)?.style;
                const fillColor = s?.fill;
                if (fillColor === 'none') return;
                const color =
                  fillColor && fillColor !== ''
                    ? new THREE.Color(fillColor)
                    : new THREE.Color(0xffffff);
                const material = new THREE.MeshBasicMaterial({
                  color,
                  transparent: true,
                  depthWrite: false,
                  side: THREE.DoubleSide,
                });
                const shapes = SVGLoader.createShapes(path);
                shapes.forEach((shape) => {
                  const geometry = new THREE.ShapeGeometry(shape);
                  const mesh = new THREE.Mesh(geometry, material);
                  group.add(mesh);
                });
              });
              group.scale.set(1, -1, 1);
              const box = new THREE.Box3().setFromObject(group);
              const size = new THREE.Vector3();
              box.getSize(size);
              const scale = Math.min(
                width / Math.max(0.001, size.x),
                height / Math.max(0.001, size.y),
              );
              group.scale.set(scale, -scale, 1);
              box.setFromObject(group);
              const center = new THREE.Vector3();
              box.getCenter(center);
              group.position.set(-center.x, -center.y, 0);
              resolve(group);
            },
            undefined,
            (err) => {
              console.warn(`[DiagramRenderer] Failed to load SVG icon: ${url}`, err);
              this.cache.delete(cacheKey);
              resolve(new THREE.Group());
            },
          );
        }
      } else {
        this.textureLoader.load(
          url,
          (texture) => {
            const geometry = new THREE.PlaneGeometry(width, height);
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
            });
            const mesh = new THREE.Mesh(geometry, material);
            resolve(mesh);
          },
          undefined,
          (err) => {
            console.warn(`[DiagramRenderer] Failed to load texture icon: ${url}`, err);
            this.cache.delete(cacheKey);
            resolve(new THREE.Mesh());
          },
        );
      }
    }).then((obj) => {
      if (obj instanceof THREE.Group && obj.children.length === 0) {
        this.cache.delete(cacheKey);
      }
      return obj;
    });

    this.cache.set(cacheKey, promise);
    return promise;
  }

  disposeAll(): void {
    this.cache.clear();
  }
}

export const sharedIconLoader: IIconLoader = new IconLoaderImpl();
