// Three.js post-processing renderer for bloom, vignette, and color grading.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { PostFxState } from './types';

/**
 * Vignette + color grade shader for the final compositing pass.
 * Applied after bloom to darken edges and subtly shift color balance.
 */
const VignetteGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignetteStrength: { value: 0.3 },
    uGradeMix: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignetteStrength;
    uniform float uGradeMix;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Vignette: darken edges with smooth falloff
      vec2 uv = vUv * 2.0 - 1.0;
      float dist = length(uv);
      float vignette = smoothstep(0.4, 1.4, dist) * uVignetteStrength;
      color.rgb *= 1.0 - vignette;

      // Subtle color grade: slight warm/cool shift
      vec3 graded = color.rgb;
      graded.r *= 1.0 + uGradeMix * 0.05;
      graded.b *= 1.0 - uGradeMix * 0.03;
      color.rgb = mix(color.rgb, graded, uGradeMix);

      gl_FragColor = color;
    }
  `,
};

/** Post-processing composer managing bloom, vignette, and color grading. */
export class PostFxRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  /** Initialize the composer and effect passes. */
  private init(): void {
    if (this.composer) return;

    try {
      this.composer = new EffectComposer(this.renderer);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      const size = this.renderer.getSize(new THREE.Vector2());
      this.bloomPass = new UnrealBloomPass(size, 0.3, 0.4, 0.85);
      this.composer.addPass(this.bloomPass);

      this.gradePass = new ShaderPass(VignetteGradeShader);
      this.composer.addPass(this.gradePass);

      this.lastWidth = size.x;
      this.lastHeight = size.y;
    } catch (err) {
      console.warn('[PostFxRenderer] Failed to initialize post-processing.', err);
      this.disposeComposer();
    }
  }

  /** Render a frame with post-processing effects applied. */
  render(state: PostFxState, camera: THREE.Camera): void {
    if (!state.enabled || state.quality === 'off') return;
    if (!this.composer) this.init();
    if (!this.composer) return;

    // Update camera reference if changed
    this.camera = camera;
    const renderPass = this.composer.passes[0] as RenderPass;
    if (renderPass) renderPass.camera = camera;

    // Resize if viewport changed
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== this.lastWidth || size.y !== this.lastHeight) {
      const pixelRatio = this.renderer.getPixelRatio();
      this.composer.setSize(size.x * pixelRatio, size.y * pixelRatio);
      this.lastWidth = size.x;
      this.lastHeight = size.y;
    }

    // Update bloom parameters
    if (this.bloomPass) {
      this.bloomPass.strength = state.bloomStrength;
      this.bloomPass.radius = state.bloomRadius;
      this.bloomPass.threshold = state.bloomThreshold;
    }

    // Update vignette/grade parameters
    if (this.gradePass) {
      this.gradePass.uniforms['uVignetteStrength'].value = state.vignetteStrength;
      this.gradePass.uniforms['uGradeMix'].value = state.gradeMix;
    }

    this.composer.render();
  }

  /** Release all composer resources and passes. */
  dispose(): void {
    this.disposeComposer();
  }

  private disposeComposer(): void {
    if (this.composer) {
      for (const pass of this.composer.passes) {
        if ('dispose' in pass && typeof pass.dispose === 'function') {
          pass.dispose();
        }
      }

      // Dispose render targets
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();

      this.composer = null;
    }
    this.bloomPass = null;
    this.gradePass = null;
  }
}
