/**
 * Local MediaPipe Pose Tracker (Stage A)
 * Uses local WebAssembly and local model (no external CDN calls).
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left Arm (emerald)
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right Arm (amber)
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Left Leg (emerald)
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right Leg (amber)
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
];

export const KEY_JOINTS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
};

export class MediaPipePoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.delegate = 'GPU';
    this.isInitialized = false;
    this.lastVideoTime = -1;
  }

  async initialize(onProgress = () => {}) {
    onProgress('Loading local MediaPipe WASM runtime...');

    // 1. Resolve WASM from local public directory (100% offline, no CDN)
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

    onProgress('Initializing Pose Landmarker model...');

    // 2. Attempt GPU delegate first, fallback to CPU if WebGL fails
    try {
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_heavy.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.delegate = 'GPU';
    } catch (gpuErr) {
      console.warn('[MediaPipePoseTracker] GPU delegate failed, falling back to CPU:', gpuErr);
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_heavy.task',
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.delegate = 'CPU';
    }

    this.isInitialized = true;
    return { delegate: this.delegate };
  }

  detectForVideo(videoElement, timestampMs) {
    if (!this.poseLandmarker || !this.isInitialized) return null;
    if (videoElement.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = videoElement.currentTime;

    try {
      const result = this.poseLandmarker.detectForVideo(videoElement, timestampMs);
      return result;
    } catch (err) {
      console.error('[MediaPipePoseTracker] Detection error:', err);
      return null;
    }
  }

  close() {
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (err) {
        console.warn('[MediaPipePoseTracker] Error closing landmarker:', err);
      }
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }
}
