/**
 * Local Full-Body Pose Retargeter (Stage C)
 * Maps MediaPipe 33-point body landmarks to VRM humanoid bones in real time.
 *
 * Features:
 * - Full-body humanoid bone retargeting: Hips, Spine, Chest, Neck, Head,
 *   Left/Right Upper Arm, Lower Arm, Hand, Left/Right Upper Leg, Lower Leg, Foot.
 * - Quaternion-based bone rotations with Slerp exponential smoothing.
 * - Anatomical joint limits (preventing elbow/knee hyperextension).
 * - Left/Right mirror coordinate mapping.
 * - Graceful fallback & return-to-rest pose when tracking confidence drops.
 * - Zero allocations in per-frame animation loop (pre-allocated scratch buffers).
 */

import * as THREE from 'three';

// Bone rest directions in VRM 1.0 normalized bone local space
const REST_ARM_LEFT = new THREE.Vector3(1, 0, 0);       // +X
const REST_ARM_RIGHT = new THREE.Vector3(-1, 0, 0);     // -X
const REST_LEG_DOWN = new THREE.Vector3(0, -1, 0);      // -Y
const REST_UP = new THREE.Vector3(0, 1, 0);             // +Y
const REST_FORWARD = new THREE.Vector3(0, 0, 1);        // +Z
const IDENTITY_QUAT = new THREE.Quaternion(0, 0, 0, 1);

export class PoseRetargeter {
  constructor() {
    this.vrm = null;
    this.humanoid = null;
    this.boneNodes = new Map();

    // Smoothed target quaternions for each bone
    this.smoothedRotations = new Map();

    // Default rest quaternions (identity for normalized VRM bones)
    this.restRotations = new Map();

    // Smoothing factor (0.0: frozen, 1.0: instantaneous/raw)
    this.smoothingAlpha = 0.28;

    // Minimum visibility confidence threshold for landmarks
    this.minConfidence = 0.45;

    // State metrics
    this.activeBoneCount = 0;
    this.isTrackingActive = false;
    this.retargetStatus = 'Ready (Rest Pose)';

    // Pre-allocated scratch objects to prevent garbage collection stutter
    this._vUpper = new THREE.Vector3();
    this._vLower = new THREE.Vector3();
    this._vHand = new THREE.Vector3();
    this._vLocal = new THREE.Vector3();
    this._vSpine = new THREE.Vector3();
    this._vHead = new THREE.Vector3();
    this._vShoulderLine = new THREE.Vector3();
    this._vHipLine = new THREE.Vector3();

    this._qUpper = new THREE.Quaternion();
    this._qLower = new THREE.Quaternion();
    this._qHand = new THREE.Quaternion();
    this._qTorso = new THREE.Quaternion();
    this._qHead = new THREE.Quaternion();
    this._qInv = new THREE.Quaternion();
    this._qTemp = new THREE.Quaternion();

    // Reusable 3D landmark coordinate buffers
    this.coords3D = new Array(33).fill(null).map(() => new THREE.Vector3());
    this.visibilities = new Array(33).fill(0);
  }

  /**
   * Bind a VRM humanoid instance to this retargeter
   */
  bindVRM(vrmInstance) {
    this.vrm = vrmInstance;
    this.humanoid = vrmInstance?.humanoid || null;
    this.boneNodes.clear();
    this.smoothedRotations.clear();
    this.restRotations.clear();

    if (!this.humanoid) {
      console.warn('[PoseRetargeter] No humanoid found on VRM instance.');
      return;
    }

    const boneNames = [
      'hips',
      'spine',
      'chest',
      'neck',
      'head',
      'leftUpperArm',
      'leftLowerArm',
      'leftHand',
      'rightUpperArm',
      'rightLowerArm',
      'rightHand',
      'leftUpperLeg',
      'leftLowerLeg',
      'leftFoot',
      'rightUpperLeg',
      'rightLowerLeg',
      'rightFoot'
    ];

    let boundCount = 0;
    for (const name of boneNames) {
      const node = this.humanoid.getNormalizedBoneNode(name);
      if (node) {
        this.boneNodes.set(name, node);
        this.smoothedRotations.set(name, new THREE.Quaternion().copy(IDENTITY_QUAT));
        this.restRotations.set(name, new THREE.Quaternion().copy(IDENTITY_QUAT));
        boundCount++;
      }
    }

    this.activeBoneCount = boundCount;
    this.retargetStatus = `Bound ${boundCount}/17 humanoid bones`;
    console.log(`[PoseRetargeter] ${this.retargetStatus} to VRM humanoid.`);
  }

  /**
   * Main per-frame update method.
   * Converts MediaPipe 33 landmarks into smooth VRM bone rotations.
   *
   * @param {Array} landmarks - MediaPipe raw normalized landmarks array [{x, y, z, visibility}]
   * @param {number} delta - Frame delta time in seconds
   */
  update(landmarks, delta = 0.016) {
    if (!this.humanoid || this.boneNodes.size === 0) return;

    // 1. If landmarks are absent or low quality, smoothly return toward rest pose
    if (!landmarks || landmarks.length < 33) {
      this.isTrackingActive = false;
      this.retargetStatus = 'Tracking Lost — Safe Rest Pose';
      this.returnTowardRestPose(delta);
      return;
    }

    // 2. Unpack & Mirror Landmark Coordinates
    // Mirroring: User's physical right arm -> Screen right -> Avatar's right arm
    for (let i = 0; i < 33; i++) {
      const pt = landmarks[i];
      if (pt) {
        // x mirrored: 1.0 - pt.x (or -pt.x relative to center)
        this.coords3D[i].x = -(pt.x - 0.5);
        // y inverted: Three.js +Y is up, MediaPipe +Y is down
        this.coords3D[i].y = -(pt.y - 0.5);
        // z depth: Three.js +Z is toward camera
        this.coords3D[i].z = -(pt.z || 0);
        this.visibilities[i] = pt.visibility !== undefined ? pt.visibility : 1.0;
      } else {
        this.visibilities[i] = 0;
      }
    }

    this.isTrackingActive = true;
    this.retargetStatus = 'Active — Retargeting Humanoid';

    // 3. Retarget Upper Body: Arms & Hands
    this.retargetArm('left', 11, 13, 15, 19);  // left shoulder, elbow, wrist, index
    this.retargetArm('right', 12, 14, 16, 20); // right shoulder, elbow, wrist, index

    // 4. Retarget Lower Body: Legs & Feet
    this.retargetLeg('left', 23, 25, 27, 31);  // left hip, knee, ankle, foot index
    this.retargetLeg('right', 24, 26, 28, 32); // right hip, knee, ankle, foot index

    // 5. Retarget Torso: Hips, Spine, Chest
    this.retargetTorso();

    // 6. Retarget Head & Neck
    this.retargetHead();

    // 7. Apply smoothed rotations to Three.js normalized bone nodes
    for (const [name, node] of this.boneNodes.entries()) {
      const targetQuat = this.smoothedRotations.get(name);
      if (targetQuat && node) {
        node.quaternion.copy(targetQuat);
      }
    }
  }

  /**
   * Retarget a 3-chain arm (UpperArm -> LowerArm -> Hand)
   */
  retargetArm(side, shoulderIdx, elbowIdx, wristIdx, indexFingerIdx) {
    const isLeft = side === 'left';
    const restDir = isLeft ? REST_ARM_LEFT : REST_ARM_RIGHT;

    const shoulder = this.coords3D[shoulderIdx];
    const elbow = this.coords3D[elbowIdx];
    const wrist = this.coords3D[wristIdx];
    const finger = this.coords3D[indexFingerIdx];

    const visShoulder = this.visibilities[shoulderIdx];
    const visElbow = this.visibilities[elbowIdx];
    const visWrist = this.visibilities[wristIdx];

    const upperBone = this.boneNodes.get(`${side}UpperArm`);
    const lowerBone = this.boneNodes.get(`${side}LowerArm`);
    const handBone = this.boneNodes.get(`${side}Hand`);

    // A. Upper Arm: Shoulder -> Elbow
    if (upperBone && visShoulder > this.minConfidence && visElbow > this.minConfidence) {
      this._vUpper.subVectors(elbow, shoulder);
      if (this._vUpper.lengthSq() > 0.0001) {
        this._vUpper.normalize();
        this._qUpper.setFromUnitVectors(restDir, this._vUpper);

        // Exponential smoothing
        const currentQ = this.smoothedRotations.get(`${side}UpperArm`);
        currentQ.slerp(this._qUpper, this.smoothingAlpha);
      }
    } else {
      // Confidence low: decay toward rest
      this.decayBoneToRest(`${side}UpperArm`);
    }

    // B. Lower Arm: Elbow -> Wrist
    if (lowerBone && visElbow > this.minConfidence && visWrist > this.minConfidence) {
      this._vLower.subVectors(wrist, elbow);
      if (this._vLower.lengthSq() > 0.0001) {
        this._vLower.normalize();

        // Convert world target vector into parent (Upper Arm) local space
        const upperCurrentQ = this.smoothedRotations.get(`${side}UpperArm`);
        this._qInv.copy(upperCurrentQ).invert();
        this._vLocal.copy(this._vLower).applyQuaternion(this._qInv);

        // Anatomical limit check: prevent unnatural backwards hyperextension
        if (this._vLocal.dot(restDir) < -0.3) {
          this._vLocal.set(restDir.x * 0.7, -0.7, 0).normalize();
        }

        this._qLower.setFromUnitVectors(restDir, this._vLocal);

        const currentQ = this.smoothedRotations.get(`${side}LowerArm`);
        currentQ.slerp(this._qLower, this.smoothingAlpha);
      }
    } else {
      this.decayBoneToRest(`${side}LowerArm`);
    }

    // C. Hand: Wrist -> Index Finger
    if (handBone && visWrist > this.minConfidence) {
      const visFinger = this.visibilities[indexFingerIdx];
      if (visFinger > this.minConfidence) {
        this._vHand.subVectors(finger, wrist);
        if (this._vHand.lengthSq() > 0.0001) {
          this._vHand.normalize();

          // Transform into Lower Arm local space
          const upperCurrentQ = this.smoothedRotations.get(`${side}UpperArm`);
          const lowerCurrentQ = this.smoothedRotations.get(`${side}LowerArm`);
          this._qTemp.multiplyQuaternions(upperCurrentQ, lowerCurrentQ).invert();
          this._vLocal.copy(this._vHand).applyQuaternion(this._qTemp);

          this._qHand.setFromUnitVectors(restDir, this._vLocal);
          const currentQ = this.smoothedRotations.get(`${side}Hand`);
          currentQ.slerp(this._qHand, this.smoothingAlpha * 0.8);
        }
      }
    } else {
      this.decayBoneToRest(`${side}Hand`);
    }
  }

  /**
   * Retarget a 3-chain leg (UpperLeg -> LowerLeg -> Foot)
   */
  retargetLeg(side, hipIdx, kneeIdx, ankleIdx, footIdx) {
    const restDir = REST_LEG_DOWN;

    const hip = this.coords3D[hipIdx];
    const knee = this.coords3D[kneeIdx];
    const ankle = this.coords3D[ankleIdx];
    const foot = this.coords3D[footIdx];

    const visHip = this.visibilities[hipIdx];
    const visKnee = this.visibilities[kneeIdx];
    const visAnkle = this.visibilities[ankleIdx];

    const upperBone = this.boneNodes.get(`${side}UpperLeg`);
    const lowerBone = this.boneNodes.get(`${side}LowerLeg`);
    const footBone = this.boneNodes.get(`${side}Foot`);

    // A. Upper Leg: Hip -> Knee
    if (upperBone && visHip > this.minConfidence && visKnee > this.minConfidence) {
      this._vUpper.subVectors(knee, hip);
      if (this._vUpper.lengthSq() > 0.0001) {
        this._vUpper.normalize();
        this._qUpper.setFromUnitVectors(restDir, this._vUpper);

        const currentQ = this.smoothedRotations.get(`${side}UpperLeg`);
        currentQ.slerp(this._qUpper, this.smoothingAlpha);
      }
    } else {
      this.decayBoneToRest(`${side}UpperLeg`);
    }

    // B. Lower Leg: Knee -> Ankle
    if (lowerBone && visKnee > this.minConfidence && visAnkle > this.minConfidence) {
      this._vLower.subVectors(ankle, knee);
      if (this._vLower.lengthSq() > 0.0001) {
        this._vLower.normalize();

        const upperCurrentQ = this.smoothedRotations.get(`${side}UpperLeg`);
        this._qInv.copy(upperCurrentQ).invert();
        this._vLocal.copy(this._vLower).applyQuaternion(this._qInv);

        // Anatomical limit: Knee only bends backwards (towards +Z in local space)
        if (this._vLocal.z < -0.05) {
          this._vLocal.z = 0; // Prevent forward knee hyperextension
          this._vLocal.normalize();
        }

        this._qLower.setFromUnitVectors(restDir, this._vLocal);

        const currentQ = this.smoothedRotations.get(`${side}LowerLeg`);
        currentQ.slerp(this._qLower, this.smoothingAlpha);
      }
    } else {
      this.decayBoneToRest(`${side}LowerLeg`);
    }

    // C. Foot: Ankle -> Foot Index (Toes)
    if (footBone && visAnkle > this.minConfidence) {
      const visFoot = this.visibilities[footIdx];
      if (visFoot > this.minConfidence) {
        this._vHand.subVectors(foot, ankle);
        if (this._vHand.lengthSq() > 0.0001) {
          this._vHand.normalize();

          const upperCurrentQ = this.smoothedRotations.get(`${side}UpperLeg`);
          const lowerCurrentQ = this.smoothedRotations.get(`${side}LowerLeg`);
          this._qTemp.multiplyQuaternions(upperCurrentQ, lowerCurrentQ).invert();
          this._vLocal.copy(this._vHand).applyQuaternion(this._qTemp);

          this._qHand.setFromUnitVectors(REST_FORWARD, this._vLocal);
          const currentQ = this.smoothedRotations.get(`${side}Foot`);
          currentQ.slerp(this._qHand, this.smoothingAlpha * 0.7);
        }
      }
    } else {
      this.decayBoneToRest(`${side}Foot`);
    }
  }

  /**
   * Retarget Torso (Hips, Spine, Chest)
   */
  retargetTorso() {
    const leftHip = this.coords3D[23];
    const rightHip = this.coords3D[24];
    const leftShoulder = this.coords3D[11];
    const rightShoulder = this.coords3D[12];

    const visHip = (this.visibilities[23] + this.visibilities[24]) / 2;
    const visShoulder = (this.visibilities[11] + this.visibilities[12]) / 2;

    if (visHip > this.minConfidence && visShoulder > this.minConfidence) {
      // Mid-hip and Mid-shoulder
      const midHipX = (leftHip.x + rightHip.x) / 2;
      const midHipY = (leftHip.y + rightHip.y) / 2;
      const midHipZ = (leftHip.z + rightHip.z) / 2;

      const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const midShoulderZ = (leftShoulder.z + rightShoulder.z) / 2;

      // Spine tilt vector
      this._vSpine.set(
        midShoulderX - midHipX,
        midShoulderY - midHipY,
        midShoulderZ - midHipZ
      );

      if (this._vSpine.lengthSq() > 0.0001) {
        this._vSpine.normalize();
        this._qTorso.setFromUnitVectors(REST_UP, this._vSpine);

        // Body Yaw (Twist from shoulder line)
        this._vShoulderLine.subVectors(leftShoulder, rightShoulder).normalize();
        const yaw = Math.atan2(this._vShoulderLine.z, this._vShoulderLine.x);
        this._qTemp.setFromAxisAngle(REST_UP, yaw * 0.6);
        this._qTorso.multiply(this._qTemp);

        // Distribute 45% to Spine, 55% to Chest
        const spineQ = this.smoothedRotations.get('spine');
        const chestQ = this.smoothedRotations.get('chest');
        const hipsQ = this.smoothedRotations.get('hips');

        if (spineQ) {
          this._qTemp.copy(IDENTITY_QUAT).slerp(this._qTorso, 0.45);
          spineQ.slerp(this._qTemp, this.smoothingAlpha * 0.8);
        }
        if (chestQ) {
          this._qTemp.copy(IDENTITY_QUAT).slerp(this._qTorso, 0.55);
          chestQ.slerp(this._qTemp, this.smoothingAlpha * 0.8);
        }
        if (hipsQ) {
          this._qTemp.setFromAxisAngle(REST_UP, yaw * 0.4);
          hipsQ.slerp(this._qTemp, this.smoothingAlpha * 0.6);
        }
      }
    } else {
      this.decayBoneToRest('spine');
      this.decayBoneToRest('chest');
      this.decayBoneToRest('hips');
    }
  }

  /**
   * Retarget Neck and Head
   */
  retargetHead() {
    const nose = this.coords3D[0];
    const leftShoulder = this.coords3D[11];
    const rightShoulder = this.coords3D[12];

    const visNose = this.visibilities[0];
    const visShoulder = (this.visibilities[11] + this.visibilities[12]) / 2;

    const headBone = this.boneNodes.get('head');
    const neckBone = this.boneNodes.get('neck');

    if (headBone && visNose > this.minConfidence && visShoulder > this.minConfidence) {
      const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const midShoulderZ = (leftShoulder.z + rightShoulder.z) / 2;

      this._vHead.set(
        nose.x - midShoulderX,
        nose.y - midShoulderY,
        nose.z - midShoulderZ
      );

      if (this._vHead.lengthSq() > 0.0001) {
        this._vHead.normalize();

        // Invert torso rotation so head is relative to chest
        const chestQ = this.smoothedRotations.get('chest') || IDENTITY_QUAT;
        this._qInv.copy(chestQ).invert();
        this._vLocal.copy(this._vHead).applyQuaternion(this._qInv);

        this._qHead.setFromUnitVectors(REST_UP, this._vLocal);

        // Distribute to neck (40%) and head (60%)
        if (neckBone) {
          const neckQ = this.smoothedRotations.get('neck');
          this._qTemp.copy(IDENTITY_QUAT).slerp(this._qHead, 0.4);
          neckQ.slerp(this._qTemp, this.smoothingAlpha);
        }

        const headQ = this.smoothedRotations.get('head');
        this._qTemp.copy(IDENTITY_QUAT).slerp(this._qHead, 0.6);
        headQ.slerp(this._qTemp, this.smoothingAlpha);
      }
    } else {
      this.decayBoneToRest('neck');
      this.decayBoneToRest('head');
    }
  }

  /**
   * Smoothly decay a bone towards identity rest pose
   */
  decayBoneToRest(boneName) {
    const currentQ = this.smoothedRotations.get(boneName);
    if (currentQ) {
      currentQ.slerp(IDENTITY_QUAT, 0.12);
    }
  }

  /**
   * When tracking is completely lost, gracefully return all bones to safe T-pose rest
   */
  returnTowardRestPose(delta) {
    for (const [name, node] of this.boneNodes.entries()) {
      const currentQ = this.smoothedRotations.get(name);
      if (currentQ) {
        currentQ.slerp(IDENTITY_QUAT, 0.1);
        if (node) {
          node.quaternion.copy(currentQ);
        }
      }
    }
  }

  /**
   * Reset all bones immediately to rest pose
   */
  resetToRestPose() {
    for (const [name, node] of this.boneNodes.entries()) {
      const currentQ = this.smoothedRotations.get(name);
      if (currentQ) currentQ.copy(IDENTITY_QUAT);
      if (node) node.quaternion.copy(IDENTITY_QUAT);
    }
  }

  /**
   * Return detailed telemetry for developer debugging overlay
   */
  getTelemetry() {
    return {
      activeBones: this.activeBoneCount,
      totalBonesTracked: this.boneNodes.size,
      status: this.retargetStatus,
      isTracking: this.isTrackingActive
    };
  }
}
