/**
 * Real VRM Avatar Loader
 * Uses Three.js GLTFLoader and @pixiv/three-vrm plugin.
 * Validates humanoid bones, applies VRM 0.x orientation correction, and prepares scene framing.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMRequiredHumanBoneName } from '@pixiv/three-vrm';

export class AvatarLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    // Separate plain GLTFLoader for standalone 3D weapon/prop .glb models
    this.propLoader = new GLTFLoader();
  }

  /**
   * Checks whether a real non-empty binary asset (.vrm or .glb) exists at `url`.
   * Rejects 404 responses and Vite SPA `text/html` fallback responses.
   */
  async checkAssetAvailable(url) {
    if (!url) return false;
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!res.ok) return false;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) return false;
      const contentLength = res.headers.get('content-length');
      if (contentLength !== null && parseInt(contentLength, 10) <= 0) return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load a .vrm file from a URL or local asset path
   */
  async loadVRM(url, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            reject(new Error('Loaded asset is not a valid VRM model (no VRM metadata found).'));
            return;
          }

          // 1. Optimize geometry & remove unneeded joints
          try {
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.removeUnnecessaryJoints(gltf.scene);
          } catch (e) {
            console.warn('[AvatarLoader] Optimization notice:', e);
          }

          // 2. Rotate VRM 0.x models to face the camera (+Z)
          try {
            VRMUtils.rotateVRM0(vrm);
          } catch (e) {
            console.warn('[AvatarLoader] rotateVRM0 notice:', e);
          }

          // 3. Validate Humanoid Rig
          const humanoid = vrm.humanoid;
          const missingBones = [];
          const foundBones = [];

          if (humanoid) {
            for (const [, boneName] of Object.entries(VRMRequiredHumanBoneName)) {
              const node = humanoid.getNormalizedBoneNode(boneName);
              if (node) {
                foundBones.push(boneName);
              } else {
                missingBones.push(boneName);
              }
            }
          }

          const skeletonValidated = Boolean(humanoid) && missingBones.length === 0;

          // 4. Measure Bounding Box to determine character height
          const bbox = new THREE.Box3().setFromObject(vrm.scene);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const height = size.y || 1.6;

          // Enable shadow casting & receiving on meshes
          vrm.scene.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              if (obj.material) {
                obj.material.side = THREE.FrontSide;
              }
            }
          });

          console.log(`[AvatarLoader] VRM Loaded: "${vrm.meta?.name || 'Avatar'}" | Height: ${height.toFixed(2)}m | Validated Bones: ${foundBones.length}/15`);

          resolve({
            vrm,
            scene: vrm.scene,
            humanoid,
            skeletonValidated,
            foundBones,
            missingBones,
            height,
            name: vrm.meta?.name || 'Humanoid VRM',
            metaVersion: vrm.meta?.metaVersion || '1.0'
          });
        },
        (progressEvent) => {
          if (progressEvent.lengthComputable && progressEvent.total > 0) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(`Loading 3D Avatar: ${pct}%`);
          } else {
            onProgress('Loading 3D Avatar...');
          }
        },
        (err) => {
          console.error('[AvatarLoader] Failed to load VRM:', err);
          reject(err);
        }
      );
    });
  }

  /**
   * Load a standalone 3D weapon/prop .glb asset
   */
  async loadPropGLB(url, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      this.propLoader.load(
        url,
        (gltf) => {
          const propScene = gltf.scene;
          if (!propScene) {
            reject(new Error(`Prop asset "${url}" contains no 3D scene.`));
            return;
          }
          propScene.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          console.log(`[AvatarLoader] 3D Prop Loaded: "${url}"`);
          resolve(propScene);
        },
        (progressEvent) => {
          if (progressEvent.lengthComputable && progressEvent.total > 0) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(`Loading 3D Weapon Prop: ${pct}%`);
          }
        },
        (err) => {
          console.error('[AvatarLoader] Failed to load 3D prop GLB:', err);
          reject(err);
        }
      );
    });
  }

  /**
   * Attach a separate 3D weapon/prop object to a VRM humanoid hand bone
   * so it moves naturally with MediaPipe + PoseRetargeter hand tracking.
   */
  attachPropToHandBone(vrm, propScene, propConfig = {}) {
    if (!vrm || !vrm.humanoid || !propScene) {
      return { attached: false, boneName: null, reason: 'Missing VRM humanoid or prop scene' };
    }

    const boneName = propConfig.targetBone || 'rightHand';
    const handNode =
      vrm.humanoid.getNormalizedBoneNode(boneName) ||
      vrm.humanoid.getRawBoneNode(boneName);

    if (!handNode) {
      console.warn(`[AvatarLoader] Hand bone "${boneName}" not found on VRM humanoid.`);
      return { attached: false, boneName, reason: `Bone "${boneName}" missing on VRM rig` };
    }

    const [px, py, pz] = propConfig.position || [0, 0, 0];
    const [rx, ry, rz] = propConfig.rotation || [0, 0, 0];
    const [sx, sy, sz] = propConfig.scale || [1, 1, 1];

    propScene.position.set(px, py, pz);
    propScene.rotation.set(rx, ry, rz);
    propScene.scale.set(sx, sy, sz);

    handNode.add(propScene);
    console.log(`[AvatarLoader] Attached prop "${propConfig.name || propConfig.path}" to VRM bone "${boneName}".`);
    return { attached: true, boneName };
  }

  /**
   * Detach a 3D weapon/prop from its parent bone and dispose its GPU resources
   */
  detachAndDisposeProp(propScene) {
    if (!propScene) return;
    try {
      if (propScene.parent) {
        propScene.parent.remove(propScene);
      }
      propScene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    } catch (e) {
      console.warn('[AvatarLoader] Prop disposal notice:', e);
    }
  }

  /**
   * Safely dispose of Three.js VRM resources
   */
  disposeVRM(vrm) {
    if (!vrm) return;
    try {
      VRMUtils.deepDispose(vrm.scene);
      console.log('[AvatarLoader] VRM resources disposed cleanly.');
    } catch (e) {
      console.warn('[AvatarLoader] Disposal error:', e);
    }
  }
}
