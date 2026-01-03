import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';

export interface SceneConfig {
  container: HTMLElement;
  onHover?: (object: THREE.Object3D | null) => void;
}

@Injectable()
export class ThreeSceneService {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private interactiveObjects: THREE.Object3D[] = [];
  private hoveredObject: THREE.Object3D | null = null;
  private animationCallbacks: Array<(delta: number, hoveredObject: THREE.Object3D | null) => void> = [];
  private clock = new THREE.Clock();
  private onHoverCallback?: (object: THREE.Object3D | null) => void;

  constructor(private ngZone: NgZone) {}

  initialize(config: SceneConfig): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    const { container, onHover } = config;
    this.onHoverCallback = onHover;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);
    this.scene.fog = new THREE.FogExp2(0x0a1628, 0.05);

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.z = 5;

    // Create renderer with antialiasing
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Add ambient and directional lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);

    // Setup resize handling
    this.setupResizeObserver(container);

    // Setup mouse interaction
    this.setupMouseInteraction(container);

    // Start animation loop outside Angular zone for performance
    this.ngZone.runOutsideAngular(() => this.animate());

    return { scene: this.scene, camera: this.camera };
  }

  addAnimationCallback(callback: (delta: number, hoveredObject: THREE.Object3D | null) => void): void {
    this.animationCallbacks.push(callback);
  }

  registerInteractiveObject(object: THREE.Object3D): void {
    this.interactiveObjects.push(object);
  }

  private setupResizeObserver(container: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.resizeObserver.observe(container);
  }

  private setupMouseInteraction(container: HTMLElement): void {
    container.addEventListener('mousemove', (event) => {
      const rect = container.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    });

    container.addEventListener('mouseleave', () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // Raycasting for hover detection
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    const newHovered = intersects.length > 0 ? intersects[0].object : null;
    if (newHovered !== this.hoveredObject) {
      this.hoveredObject = newHovered;
      this.onHoverCallback?.(this.hoveredObject);
    }

    // Run all animation callbacks
    this.animationCallbacks.forEach(callback => callback(delta, this.hoveredObject));

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Dispose of all geometries, materials, and textures
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material?.dispose();
        }
      }
    });

    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
