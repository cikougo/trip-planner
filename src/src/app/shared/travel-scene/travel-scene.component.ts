import { Component, ElementRef, OnDestroy, ViewChild, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ThreeSceneService } from '../three-scene/three-scene.service';
import { getStarfield } from './get-starfield';
import { drawThreeGeo } from './three-geo-json';

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

  private readonly GLOBE_RADIUS = 2;
  private globe!: THREE.Group;
  private floatingObjects: THREE.Object3D[] = [];
  private markers: THREE.Mesh[] = [];
  private glowTexture!: THREE.Texture;

  private destinations: Destination[] = [
    // Europe (only Paris and Athens)
    { name: 'Paris', lat: 48.8566, lng: 2.3522, color: 0xff6b6b }, // 0
    { name: 'Athens', lat: 37.9838, lng: 23.7275, color: 0x3498db }, // 1
    // Asia
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, color: 0x4ecdc4 }, // 2
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, color: 0xa8d8ea }, // 3
    { name: 'Singapore', lat: 1.3521, lng: 103.8198, color: 0x6bcb77 }, // 4
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018, color: 0xff9a8b }, // 5
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, color: 0xffcc5c }, // 6
    { name: 'Mumbai', lat: 19.076, lng: 72.8777, color: 0x9b59b6 }, // 7
    { name: 'Seoul', lat: 37.5665, lng: 126.978, color: 0x3498db }, // 8
    // North America
    { name: 'New York', lat: 40.7128, lng: -74.006, color: 0xffe66d }, // 9
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, color: 0xffd93d }, // 10
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194, color: 0xd4a5a5 }, // 11
    { name: 'Toronto', lat: 43.6532, lng: -79.3832, color: 0xe67e22 }, // 12
    { name: 'Mexico City', lat: 19.4326, lng: -99.1332, color: 0x16a085 }, // 13
    // South America
    { name: 'Rio', lat: -22.9068, lng: -43.1729, color: 0xaa96da }, // 14
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816, color: 0x1abc9c }, // 15
    { name: 'Lima', lat: -12.0464, lng: -77.0428, color: 0x8e44ad }, // 16
    // Africa
    { name: 'Cairo', lat: 30.0444, lng: 31.2357, color: 0xf38181 }, // 17
    { name: 'Cape Town', lat: -33.9249, lng: 18.4241, color: 0xc9b1ff }, // 18
    { name: 'Nairobi', lat: -1.2921, lng: 36.8219, color: 0xf39c12 }, // 19
    { name: 'Marrakech', lat: 31.6295, lng: -7.9811, color: 0xe67e22 }, // 20
    // Oceania
    { name: 'Sydney', lat: -33.8688, lng: 151.2093, color: 0x95e1d3 }, // 21
  ];

  constructor(private threeService: ThreeSceneService) {}

  ngAfterViewInit(): void {
    const { scene, camera } = this.threeService.initialize({
      container: this.containerRef.nativeElement,
    });

    camera.position.set(0, 0, 5.5);

    this.glowTexture = this.createGlowTexture();

    this.createStarfield(scene);
    this.createGlobe(scene);
    this.createDestinationMarkers();
    this.loadAirplanes(scene);
    this.loadSuitcase(scene);
    this.createFloatingPassport(scene);
    // this.createClouds(scene);
    this.loadSunglasses(scene);

    this.threeService.addAnimationCallback((delta, hoveredObject) => {
      this.animateScene(delta);
      this.updateHoverEffects(hoveredObject);
    });
  }

  private createGlobe(scene: THREE.Scene): void {
    this.globe = new THREE.Group();
    scene.add(this.globe);

    // Semi-transparent sphere base
    const geometry = new THREE.SphereGeometry(this.GLOBE_RADIUS, 32, 32);
    const solidMaterial = new THREE.MeshPhongMaterial({
      color: 0x0a1628,
      shininess: 10,
      transparent: true,
      opacity: 0.7,
    });
    const solidSphere = new THREE.Mesh(geometry, solidMaterial);
    this.globe.add(solidSphere);

    // Wireframe overlay
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });
    const edges = new THREE.EdgesGeometry(geometry, 1);
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.globe.add(wireframe);

    // Load GeoJSON landmasses
    fetch('geojson/ne_110m_land.json')
      .then((response) => response.json())
      .then((data) => {
        const countries = drawThreeGeo({
          json: data,
          radius: this.GLOBE_RADIUS,
          color: 0x3498db,
        });
        this.globe.add(countries);
      });

    this.threeService.registerInteractiveObject(this.globe);
  }

  private createStarfield(scene: THREE.Scene): void {
    const stars = getStarfield({ numStars: 1000 });
    scene.add(stars);
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
      const position = this.latLngToVector3(dest.lat, dest.lng, this.GLOBE_RADIUS + 0.02);
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

    // Define flight routes between destinations
    const baseVelocity = 0.1; // Consistent visual speed (radians per second on globe surface)
    const routes = [
      // Long-haul routes
      { from: this.destinations[0], to: this.destinations[2], offset: 0 }, // Paris -> Tokyo
      { from: this.destinations[9], to: this.destinations[21], offset: 0.33 }, // New York -> Sydney
      { from: this.destinations[3], to: this.destinations[4], offset: 0.15 }, // Dubai -> Singapore
      { from: this.destinations[10], to: this.destinations[2], offset: 0.5 }, // Los Angeles -> Tokyo
      { from: this.destinations[14], to: this.destinations[18], offset: 0.8 }, // Rio -> Cape Town
      { from: this.destinations[11], to: this.destinations[12], offset: 0.55 }, // San Francisco -> Toronto
      { from: this.destinations[7], to: this.destinations[21], offset: 0.35 }, // Mumbai -> Sydney
      { from: this.destinations[8], to: this.destinations[10], offset: 0.85 }, // Seoul -> Los Angeles
      { from: this.destinations[9], to: this.destinations[0], offset: 0.6 }, // New York -> Paris
      { from: this.destinations[19], to: this.destinations[0], offset: 0.3 }, // Nairobi -> Paris
      { from: this.destinations[20], to: this.destinations[9], offset: 0.75 }, // Marrakech -> New York
      { from: this.destinations[16], to: this.destinations[15], offset: 0.5 }, // Lima -> Buenos Aires
      { from: this.destinations[1], to: this.destinations[3], offset: 0.65 }, // Athens -> Dubai
      { from: this.destinations[5], to: this.destinations[21], offset: 0.4 }, // Bangkok -> Sydney
      { from: this.destinations[6], to: this.destinations[11], offset: 0.25 }, // Hong Kong -> San Francisco
    ];

    loader.load('models/low_poly_airplane.glb', (gltf) => {
      routes.forEach((route) => {
        const airplane = gltf.scene.clone();
        airplane.scale.setScalar(0.08);

        // Calculate angular distance between points (great circle approximation)
        const lat1 = (route.from.lat * Math.PI) / 180;
        const lat2 = (route.to.lat * Math.PI) / 180;
        const dLat = lat2 - lat1;
        const dLng = ((route.to.lng - route.from.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        // Speed = baseVelocity / distance (so all planes move at same visual speed)
        const flightSpeed = baseVelocity / angularDistance;

        airplane.userData = {
          isFlying: true,
          fromLat: route.from.lat,
          fromLng: route.from.lng,
          toLat: route.to.lat,
          toLng: route.to.lng,
          flightProgress: route.offset,
          flightSpeed,
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
      suitcase.position.set(1.2, 0.5, 3.0);
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
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('models/passport.png', (texture) => {
      // Get aspect ratio from texture
      const aspectRatio = texture.image.width / texture.image.height;
      const height = 0.5;
      const width = height * aspectRatio;

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        color: 0xaaaaaa, // Darken the texture
      });

      const passport = new THREE.Mesh(geometry, material);
      passport.position.set(1.0, -1.0, 3.0);
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
    });
  }

  private loadSunglasses(scene: THREE.Scene): void {
    const loader = new GLTFLoader();
    loader.load('models/sun_glasses_low_poly.glb', (gltf) => {
      const sunglasses = gltf.scene;
      sunglasses.scale.setScalar(0.0015);
      sunglasses.position.set(-0.8, -1.2, 3.2);
      sunglasses.rotation.set(0, 0.6, 0.36);

      sunglasses.userData = {
        basePosition: sunglasses.position.clone(),
        floatOffset: Math.PI * 0.75,
        floatSpeed: 0.9,
        baseScale: 0.0015,
        currentScale: 0.0015,
        targetScale: 0.0015,
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
      { orbitRadius: 2.12, orbitSpeed: 0.15, orbitOffset: 0, yOffset: 0.6, scale: 0.3 },
      { orbitRadius: 2.15, orbitSpeed: 0.12, orbitOffset: Math.PI / 2, yOffset: -0.4, scale: 0.35 },
      { orbitRadius: 2.1, orbitSpeed: 0.18, orbitOffset: Math.PI, yOffset: 0.1, scale: 0.25 },
      { orbitRadius: 2.14, orbitSpeed: 0.1, orbitOffset: Math.PI * 1.5, yOffset: -0.7, scale: 0.3 },
      { orbitRadius: 2.11, orbitSpeed: 0.14, orbitOffset: Math.PI / 4, yOffset: 0.9, scale: 0.22 },
      { orbitRadius: 2.13, orbitSpeed: 0.11, orbitOffset: Math.PI * 0.75, yOffset: -0.2, scale: 0.28 },
      { orbitRadius: 2.12, orbitSpeed: 0.16, orbitOffset: Math.PI * 1.25, yOffset: 0.4, scale: 0.26 },
      { orbitRadius: 2.15, orbitSpeed: 0.09, orbitOffset: Math.PI * 1.75, yOffset: -0.9, scale: 0.32 },
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
        const globeRadius = this.GLOBE_RADIUS;
        const minFlightHeight = 0.05; // Slightly above surface at start/end
        const maxFlightHeight = 0.25;
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
