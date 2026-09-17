import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export type FaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
  /** altura dos olhos em px da captura (estimada quando não há keypoints) */
  eyeY: number;
};

export class PhotoError extends Error {
  constructor(public code: "no-face" | "multiple-faces" | "generic", message: string) {
    super(message);
  }
}

let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/**
 * Detecta exatamente um rosto na captura original. Usado somente para
 * enquadramento — nunca altera a imagem.
 */
export async function detectFace(canvas: HTMLCanvasElement): Promise<FaceBox> {
  let detector: FaceDetector;
  try {
    detector = await getDetector();
  } catch {
    throw new PhotoError("generic", "Detector de rosto indisponível.");
  }

  const result = detector.detect(canvas);
  const found = (result.detections ?? []).filter((d) => d.boundingBox);

  if (found.length === 0) throw new PhotoError("no-face", "Nenhum rosto detectado.");
  if (found.length > 1) throw new PhotoError("multiple-faces", "Mais de um rosto detectado.");

  const box = found[0]!.boundingBox!;
  const keypoints = found[0]!.keypoints ?? [];
  const x = box.originX;
  const y = box.originY;
  const w = box.width;
  const h = box.height;

  // keypoints normalizados: 0 e 1 são os olhos (quando disponíveis)
  const eyes = keypoints.slice(0, 2);
  const eyeY =
    eyes.length === 2
      ? ((eyes[0]!.y + eyes[1]!.y) / 2) * canvas.height
      : y + h * 0.42;

  return { x, y, w, h, centerX: x + w / 2, centerY: y + h / 2, eyeY };
}
