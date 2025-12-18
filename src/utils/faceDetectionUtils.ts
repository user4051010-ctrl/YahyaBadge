import * as faceapi from 'face-api.js';

// Load models from a CDN to avoid large binaries in repo
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights';

let isModelLoaded = false;

export const loadFaceApiModels = async () => {
    if (isModelLoaded) return;
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        // await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL); // Slower but more accurate
        isModelLoaded = true;
        console.log("FaceAPI models loaded");
    } catch (error) {
        console.error("Error loading FaceAPI models:", error);
        throw error;
    }
};

export const detectAndCropFace = async (imageSource: string | HTMLImageElement | HTMLCanvasElement): Promise<string | null> => {
    try {
        if (!isModelLoaded) {
            await loadFaceApiModels();
        }

        let img: HTMLImageElement;

        if (typeof imageSource === 'string') {
            img = new Image();
            img.crossOrigin = "anonymous";
            img.src = imageSource;
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = (e) => {
                    console.error("Failed to load image for face detection", e);
                    resolve(null);
                };
            });
        } else if (imageSource instanceof HTMLCanvasElement) {
            // Convert canvas to image for consistency, or use canvas directly if supported
            img = new Image();
            img.src = imageSource.toDataURL();
            await new Promise((resolve) => { img.onload = resolve; });
        } else {
            img = imageSource;
        }

        // Detect face
        // using TinyFaceDetector for speed
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions());

        if (!detection) {
            console.warn("No face detected");
            return null;
        }

        const { box } = detection;

        // Add padding (e.g., 50% relative to the box size to capture hair/chin)
        const paddingFactor = 0.5;
        const width = box.width;
        const height = box.height;

        let x = box.x - (width * paddingFactor) / 2;
        let y = box.y - (height * paddingFactor) / 2;
        let w = width * (1 + paddingFactor);
        let h = height * (1 + paddingFactor);

        // Constrain to image bounds
        x = Math.max(0, x);
        y = Math.max(0, y);
        w = Math.min(img.width - x, w);
        h = Math.min(img.height - y, h);

        // Create canvas to crop
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

        return canvas.toDataURL('image/jpeg', 0.9);

    } catch (error) {
        console.error("Face detection error:", error);
        return null;
    }
};
