/**
 * Three.js Scene Manager for Holobox 3D Avatar Mirror
 * Portrait 9:16 viewport, studio lighting, full-body framing, and resource disposal.
 */

import * as THREE from 'three';

export class SceneManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    this.currentVRM = null;
    this.rimLight = null;
    this.floorRingMat = null;
    this.animationFrameId = null;

    // Separate Rendering FPS tracking
    this.renderFrameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.currentRenderFps = 0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 1080;
    const height = this.container.clientHeight || 1920;

    // 1. Perspective Camera framed for Full-Body Humanoid (FOV 30, height ~1.6m)
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20.0);
    this.camera.position.set(0, 1.05, 3.15);
    this.camera.lookAt(0, 0.9, 0);

    // 2. WebGL 2 Renderer with Tone Mapping and Antialiasing
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 3. Studio Lighting Rig
    this.setupLighting();

    // 4. Ground Studio Platform
    this.setupStudioFloor();

    // 5. Handle Window / Container Resize
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  setupLighting() {
    // Soft ambient illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    // Main key light (casts soft contact shadows)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(1.5, 3.0, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -1.5;
    keyLight.shadow.camera.right = 1.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Character-accent rim light for holographic depth separation
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-2.0, 2.5, -2.0);
    this.rimLight = rimLight;
    this.scene.add(rimLight);

    // Subtle ground bounce fill
    const fillLight = new THREE.DirectionalLight(0x10b981, 0.4);
    fillLight.position.set(0, -1.0, 1.5);
    this.scene.add(fillLight);
  }

  setupStudioFloor() {
    // Studio ground plane receiving contact shadows
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.ShadowMaterial({
      opacity: 0.35
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Circular glowing ground ring for grounding
    const ringGeo = new THREE.RingGeometry(0.7, 0.73, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    this.floorRingMat = ringMat;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    this.scene.add(ring);
  }

  /**
   * Update holographic rim light & ground ring tint to match selected fantasy character
   */
  setCharacterAccent(hexColor) {
    if (hexColor === undefined || hexColor === null) return;
    if (this.rimLight) {
      this.rimLight.color.setHex(hexColor);
    }
    if (this.floorRingMat) {
      this.floorRingMat.color.setHex(hexColor);
    }
  }

  /**
   * Remove active VRM avatar from the scene without tearing down the viewport
   */
  clearAvatar() {
    if (this.currentVRM && this.scene) {
      this.scene.remove(this.currentVRM.scene);
    }
    this.currentVRM = null;
  }

  setAvatar(vrmInstance, height = 1.62) {
    this.clearAvatar();
    this.currentVRM = vrmInstance;
    if (vrmInstance && vrmInstance.scene) {
      // Ground feet cleanly at y = 0 and center horizontally
      vrmInstance.scene.position.set(0, 0, 0);
      const bbox = new THREE.Box3().setFromObject(vrmInstance.scene);
      if (isFinite(bbox.min.y)) {
        vrmInstance.scene.position.y = -bbox.min.y;
      }
      this.scene.add(vrmInstance.scene);

      // Frame full-body portrait comfortably in Holobox display across varying heights
      if (this.camera) {
        const clampedH = Math.max(1.35, Math.min(2.3, height || 1.62));
        const midY = clampedH * 0.54;
        const dist = clampedH * 2.12;
        this.camera.position.set(0, midY + 0.12, dist);
        this.camera.lookAt(0, midY, 0);
      }
    }
  }

  startAnimationLoop(onRenderTick = () => {}) {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);

      const delta = this.clock.getDelta();
      const now = performance.now();

      // Update VRM spring bones and expressions
      if (this.currentVRM) {
        this.currentVRM.update(delta);
      }

      // Measure true Rendering FPS
      this.renderFrameCount++;
      const elapsed = now - this.lastFpsUpdate;
      if (elapsed >= 500) {
        this.currentRenderFps = Math.round((this.renderFrameCount * 1000) / elapsed);
        this.renderFrameCount = 0;
        this.lastFpsUpdate = now;
      }

      // Render Scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      onRenderTick(this.currentRenderFps);
    };

    loop();
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.onResize);

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    // Traverse and dispose geometries and materials
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.scene = null;
    this.camera = null;
  }
}
