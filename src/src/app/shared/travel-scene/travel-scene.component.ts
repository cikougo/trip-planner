import { Component, ElementRef, OnDestroy, ViewChild, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ThreeSceneService } from '../three-scene/three-scene.service';

interface Destination {
  name: string;
  lat: number;
  lng: number;
  color: number;
}

@Component({
  selector: 'app-travel-scene',
  standalone: true,
  providers: [ThreeSceneService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #sceneContainer class="w-full h-full"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class TravelSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneContainer', { static: true }) containerRef!: ElementRef<HTMLElement>;

  private globe!: THREE.Mesh;
  private floatingObjects: THREE.Object3D[] = [];
  private markers: THREE.Mesh[] = [];
  private glowTexture!: THREE.Texture;

  private destinations: Destination[] = [
    { name: 'Paris', lat: 48.8566, lng: 2.3522, color: 0xff6b6b },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, color: 0x4ecdc4 },
    { name: 'New York', lat: 40.7128, lng: -74.006, color: 0xffe66d },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093, color: 0x95e1d3 },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357, color: 0xf38181 },
    { name: 'Rio', lat: -22.9068, lng: -43.1729, color: 0xaa96da },
    { name: 'London', lat: 51.5074, lng: -0.1278, color: 0xfcbad3 },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, color: 0xa8d8ea },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198, color: 0x6bcb77 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, color: 0xffd93d },
    { name: 'Cape Town', lat: -33.9249, lng: 18.4241, color: 0xc9b1ff },
    { name: 'Moscow', lat: 55.7558, lng: 37.6173, color: 0x4d96ff },
  ];

  constructor(private threeService: ThreeSceneService) {}

  ngAfterViewInit(): void {
    const { scene, camera } = this.threeService.initialize({
      container: this.containerRef.nativeElement,
    });

    camera.position.set(0, 0, 4.5);

    this.glowTexture = this.createGlowTexture();

    this.createGlobe(scene);
    this.createDestinationMarkers();
    this.loadAirplanes(scene);
    this.loadSuitcase(scene);
    this.createFloatingPassport(scene);
    this.createClouds(scene);
    this.loadSunglasses(scene);

    this.threeService.addAnimationCallback((delta, hoveredObject) => {
      this.animateScene(delta);
      this.updateHoverEffects(hoveredObject);
    });
  }

  private createGlobe(scene: THREE.Scene): void {
    const geometry = new THREE.IcosahedronGeometry(1.5, 2);

    const material = new THREE.MeshPhongMaterial({
      color: 0x1a5276,
      flatShading: true,
      shininess: 30,
    });

    this.globe = new THREE.Mesh(geometry, material);
    scene.add(this.globe);

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wireframe = new THREE.Mesh(geometry.clone(), wireframeMaterial);
    wireframe.scale.setScalar(1.01);
    this.globe.add(wireframe);

    this.threeService.registerInteractiveObject(this.globe);
  }

  private latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }

  private createDestinationMarkers(): void {
    const markerGeometry = new THREE.SphereGeometry(0.04, 8, 8);

    this.destinations.forEach((dest) => {
      const material = new THREE.MeshBasicMaterial({ color: dest.color });

      const marker = new THREE.Mesh(markerGeometry, material);
      const position = this.latLngToVector3(dest.lat, dest.lng, 1.52);
      marker.position.copy(position);
      marker.userData = { destination: dest, baseScale: 1 };

      this.globe.add(marker);
      this.markers.push(marker);
      this.threeService.registerInteractiveObject(marker);

      const glowMaterial = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: dest.color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.setScalar(0.15);
      marker.add(glow);
    });
  }

  private createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  private loadAirplanes(scene: THREE.Scene): void {
    const loader = new GLTFLoader();

    // Define flight routes between destinations with speed adjusted for distance
    const routes = [
      { from: this.destinations[0], to: this.destinations[1], offset: 0, speed: 0.12 }, // Paris -> Tokyo
      { from: this.destinations[2], to: this.destinations[3], offset: 0.33, speed: 0.1 }, // New York -> Sydney
      { from: this.destinations[6], to: this.destinations[4], offset: 0.66, speed: 0.08 }, // London -> Cairo
      { from: this.destinations[7], to: this.destinations[8], offset: 0.15, speed: 0.1 }, // Dubai -> Singapore
      { from: this.destinations[9], to: this.destinations[1], offset: 0.5, speed: 0.11 }, // Los Angeles -> Tokyo
      { from: this.destinations[5], to: this.destinations[10], offset: 0.8, speed: 0.09 }, // Rio -> Cape Town
      { from: this.destinations[11], to: this.destinations[7], offset: 0.25, speed: 0.1 }, // Moscow -> Dubai
    ];

    loader.load('models/low_poly_airplane.glb', (gltf) => {
      routes.forEach((route) => {
        const airplane = gltf.scene.clone();
        airplane.scale.setScalar(0.08);

        airplane.userData = {
          isFlying: true,
          fromLat: route.from.lat,
          fromLng: route.from.lng,
          toLat: route.to.lat,
          toLng: route.to.lng,
          flightProgress: route.offset,
          flightSpeed: route.speed,
          flightDirection: 1, // 1 = forward, -1 = reverse
          baseScale: 0.08,
          currentScale: 0.08,
          targetScale: 0.08,
        };

        scene.add(airplane);
        this.floatingObjects.push(airplane);
        this.threeService.registerInteractiveObject(airplane);
      });
    });
  }

  private loadSuitcase(scene: THREE.Scene): void {
    const loader = new GLTFLoader();
    loader.load('models/airport_suitcase.glb', (gltf) => {
      const suitcase = gltf.scene;
      suitcase.scale.setScalar(0.55);
      suitcase.position.set(-1.0, -0.8, 2.0);
      suitcase.rotation.set(0, Math.PI / 4, 0.1); // 45 degrees around Y

      suitcase.userData = {
        basePosition: suitcase.position.clone(),
        floatOffset: Math.PI / 2,
        floatSpeed: 0.8,
        baseScale: 0.55,
        currentScale: 0.55,
        targetScale: 0.55,
      };

      scene.add(suitcase);
      this.floatingObjects.push(suitcase);
      this.threeService.registerInteractiveObject(suitcase);
    });
  }

  private createFloatingPassport(scene: THREE.Scene): void {
    const passport = new THREE.Group();

    const coverGeometry = new THREE.BoxGeometry(0.18, 0.25, 0.02);
    const coverMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a5276,
      flatShading: true,
    });
    const cover = new THREE.Mesh(coverGeometry, coverMaterial);
    passport.add(cover);

    const emblemGeometry = new THREE.CircleGeometry(0.04, 8);
    const emblemMaterial = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
    const emblem = new THREE.Mesh(emblemGeometry, emblemMaterial);
    emblem.position.z = 0.011;
    passport.add(emblem);

    passport.position.set(1.0, -1.0, 2.0);
    passport.rotation.set(0.2, -0.3, 0.1);
    passport.userData = {
      basePosition: passport.position.clone(),
      floatOffset: Math.PI,
      floatSpeed: 1.0,
      baseScale: 1,
      currentScale: 1,
      targetScale: 1,
    };

    scene.add(passport);
    this.floatingObjects.push(passport);
    this.threeService.registerInteractiveObject(passport);
  }

  private loadSunglasses(scene: THREE.Scene): void {
    const loader = new GLTFLoader();
    loader.load('models/sun_glasses_low_poly.glb', (gltf) => {
      const sunglasses = gltf.scene;
      sunglasses.scale.setScalar(0.002);
      sunglasses.position.set(-0.8, 0.2, 2.2);
      sunglasses.rotation.set(0, 0.6, 0.1);

      sunglasses.userData = {
        basePosition: sunglasses.position.clone(),
        floatOffset: Math.PI * 0.75,
        floatSpeed: 0.9,
        baseScale: 0.002,
        currentScale: 0.002,
        targetScale: 0.002,
      };

      scene.add(sunglasses);
      this.floatingObjects.push(sunglasses);
      this.threeService.registerInteractiveObject(sunglasses);
    });
  }

  private createClouds(scene: THREE.Scene): void {
    const cloudMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      flatShading: true,
    });

    const cloudConfigs = [
      { orbitRadius: 1.62, orbitSpeed: 0.15, orbitOffset: 0, yOffset: 0.6, scale: 0.3 },
      { orbitRadius: 1.65, orbitSpeed: 0.12, orbitOffset: Math.PI / 2, yOffset: -0.4, scale: 0.35 },
      { orbitRadius: 1.6, orbitSpeed: 0.18, orbitOffset: Math.PI, yOffset: 0.1, scale: 0.25 },
      { orbitRadius: 1.64, orbitSpeed: 0.1, orbitOffset: Math.PI * 1.5, yOffset: -0.7, scale: 0.3 },
      { orbitRadius: 1.61, orbitSpeed: 0.14, orbitOffset: Math.PI / 4, yOffset: 0.9, scale: 0.22 },
      { orbitRadius: 1.63, orbitSpeed: 0.11, orbitOffset: Math.PI * 0.75, yOffset: -0.2, scale: 0.28 },
      { orbitRadius: 1.62, orbitSpeed: 0.16, orbitOffset: Math.PI * 1.25, yOffset: 0.4, scale: 0.26 },
      { orbitRadius: 1.65, orbitSpeed: 0.09, orbitOffset: Math.PI * 1.75, yOffset: -0.9, scale: 0.32 },
    ];

    cloudConfigs.forEach((config) => {
      const cloud = this.createCloudGroup(cloudMaterial.clone(), config.scale);
      cloud.userData = {
        isOrbiting: true,
        orbitRadius: config.orbitRadius,
        orbitSpeed: config.orbitSpeed,
        orbitOffset: config.orbitOffset,
        yOffset: config.yOffset,
      };
      scene.add(cloud);
      this.floatingObjects.push(cloud);
    });
  }

  private createCloudGroup(material: THREE.Material, scale: number): THREE.Group {
    const cloud = new THREE.Group();
    const sphereGeometry = new THREE.IcosahedronGeometry(0.3, 1);

    const positions = [
      { x: 0, y: 0, z: 0, s: 1 },
      { x: 0.25, y: 0.1, z: 0, s: 0.8 },
      { x: -0.25, y: 0.05, z: 0, s: 0.85 },
      { x: 0.1, y: 0.15, z: 0.1, s: 0.7 },
    ];

    positions.forEach((p) => {
      const sphere = new THREE.Mesh(sphereGeometry, material);
      sphere.position.set(p.x, p.y, p.z);
      sphere.scale.setScalar(p.s);
      cloud.add(sphere);
    });

    cloud.scale.setScalar(scale);
    return cloud;
  }

  private animateScene(delta: number): void {
    const time = performance.now() * 0.001;

    if (this.globe) {
      this.globe.rotation.y += delta * 0.1;
    }

    this.floatingObjects.forEach((obj) => {
      const userData = obj.userData as Record<string, unknown>;

      if (userData['basePosition']) {
        const basePos = userData['basePosition'] as THREE.Vector3;
        const floatSpeed = userData['floatSpeed'] as number;
        const floatOffset = userData['floatOffset'] as number;

        const floatY = Math.sin(time * floatSpeed + floatOffset) * 0.1;
        const floatX = Math.cos(time * floatSpeed * 0.5 + floatOffset) * 0.05;

        obj.position.y = basePos.y + floatY;
        obj.position.x = basePos.x + floatX;

        // Smooth scale interpolation for hover effect
        if (userData['currentScale'] !== undefined && userData['targetScale'] !== undefined) {
          const currentScale = userData['currentScale'] as number;
          const targetScale = userData['targetScale'] as number;
          userData['currentScale'] = currentScale + (targetScale - currentScale) * 0.1;
          obj.scale.setScalar(userData['currentScale'] as number);
        }
      }

      if (userData['isOrbiting']) {
        const orbitRadius = userData['orbitRadius'] as number;
        const orbitSpeed = userData['orbitSpeed'] as number;
        const orbitOffset = userData['orbitOffset'] as number;
        const yOffset = userData['yOffset'] as number;

        const angle = time * orbitSpeed + orbitOffset;
        obj.position.x = Math.cos(angle) * orbitRadius;
        obj.position.z = Math.sin(angle) * orbitRadius;
        obj.position.y = yOffset + Math.sin(time * 0.5 + orbitOffset) * 0.2;
      }

      if (userData['isFlying']) {
        // Update flight progress with ping-pong movement
        let direction = userData['flightDirection'] as number;
        let progress = (userData['flightProgress'] as number) + delta * (userData['flightSpeed'] as number) * direction;

        // Reverse direction at endpoints instead of looping
        if (progress >= 1) {
          progress = 1;
          userData['flightDirection'] = -1;
        } else if (progress <= 0) {
          progress = 0;
          userData['flightDirection'] = 1;
        }
        userData['flightProgress'] = progress;

        const fromLat = userData['fromLat'] as number;
        const fromLng = userData['fromLng'] as number;
        const toLat = userData['toLat'] as number;
        const toLng = userData['toLng'] as number;

        // Interpolate lat/lng along great circle (simplified)
        const lat = fromLat + (toLat - fromLat) * progress;
        const lng = fromLng + (toLng - fromLng) * progress;

        // Height above surface: small offset at start/end, max in middle (sine curve)
        const globeRadius = 1.5;
        const minFlightHeight = 0.08; // Slightly above surface at start/end
        const maxFlightHeight = 0.4;
        const heightAboveSurface = minFlightHeight + Math.sin(progress * Math.PI) * (maxFlightHeight - minFlightHeight);
        const altitude = globeRadius + heightAboveSurface;

        const position = this.latLngToVector3(lat, lng, altitude);

        // Apply globe rotation to position
        const rotatedPosition = position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.globe.rotation.y);
        obj.position.copy(rotatedPosition);

        // Calculate next position for direction (based on current flight direction)
        const lookAheadProgress = Math.max(0.01, Math.min(progress + 0.01 * direction, 0.99));
        const nextLat = fromLat + (toLat - fromLat) * lookAheadProgress;
        const nextLng = fromLng + (toLng - fromLng) * lookAheadProgress;
        const nextHeight =
          minFlightHeight + Math.sin(lookAheadProgress * Math.PI) * (maxFlightHeight - minFlightHeight);
        const nextAltitude = globeRadius + nextHeight;
        const nextPos = this.latLngToVector3(nextLat, nextLng, nextAltitude).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          this.globe.rotation.y,
        );

        // Get surface normal at current position (points away from globe center)
        const surfaceNormal = rotatedPosition.clone().normalize();

        // Calculate flight direction (tangent to surface, pointing toward destination)
        const flightDir = nextPos.clone().sub(rotatedPosition).normalize();

        // Project flight direction onto the tangent plane (remove any component along surface normal)
        const tangentDir = flightDir
          .clone()
          .sub(surfaceNormal.clone().multiplyScalar(flightDir.dot(surfaceNormal)))
          .normalize();

        // Calculate right vector (perpendicular to both surface normal and tangent direction)
        const right = new THREE.Vector3().crossVectors(surfaceNormal, tangentDir).normalize();

        // Build rotation matrix for model where:
        // - Model nose is along -X
        // - Model top is along +Y
        // - Model wings are along Z
        // We want: nose toward destination, top away from globe
        const rotationMatrix = new THREE.Matrix4();
        // X = -tangentDir (so -X points toward destination = nose forward)
        // Y = surfaceNormal (top of plane away from globe)
        // Z = right (wings perpendicular to flight path)
        rotationMatrix.makeBasis(tangentDir.negate(), surfaceNormal, right);
        obj.quaternion.setFromRotationMatrix(rotationMatrix);

        // Smooth scale interpolation for hover effect
        if (userData['currentScale'] !== undefined && userData['targetScale'] !== undefined) {
          const currentScale = userData['currentScale'] as number;
          const targetScale = userData['targetScale'] as number;
          userData['currentScale'] = currentScale + (targetScale - currentScale) * 0.1;
          obj.scale.setScalar(userData['currentScale'] as number);
        }
      }
    });

    this.markers.forEach((marker, index) => {
      const pulse = 1 + Math.sin(time * 2 + index * 0.5) * 0.15;
      marker.scale.setScalar(pulse);
    });
  }

  private updateHoverEffects(hoveredObject: THREE.Object3D | null): void {
    const hoveredParent = hoveredObject ? this.findParentInteractive(hoveredObject) : null;

    this.floatingObjects.forEach((obj) => {
      const userData = obj.userData as Record<string, unknown>;
      if (userData['baseScale'] !== undefined) {
        const baseScale = userData['baseScale'] as number;
        userData['targetScale'] = obj === hoveredParent ? baseScale * 1.3 : baseScale;
      }
    });
  }

  private findParentInteractive(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (this.floatingObjects.includes(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  ngOnDestroy(): void {
    this.glowTexture?.dispose();
    this.threeService.dispose();
  }
}
