import type {
  Complaint,
  ComplaintCategory,
  ImageAsset,
  ImageQualityReport,
  SuspiciousFlag,
} from '../types';

export interface ImageFileValidation {
  valid: boolean;
  error?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface ReusedPhotoMatch {
  matchedImageId: string;
  matchedComplaintId?: string;
  matchedComplaintReference?: string;
  similarityPercentage: number;
  hammingDistance: number;
  isExactMatch: boolean;
}

export interface VisualClassificationResult {
  category: ComplaintCategory | 'Uncertain';
  explanation: string;
  configured: boolean;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates actual binary magic bytes and file size.
 * Prevents disguised files (e.g., .exe renamed to .jpg).
 */
export async function validateImageBytes(file: Blob | File): Promise<ImageFileValidation> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`,
      sizeBytes: file.size,
    };
  }

  if (file.size < 12) {
    return {
      valid: false,
      error: 'File is too small to be a valid image.',
      sizeBytes: file.size,
    };
  }

  try {
    const headerBuffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);

    // 1. JPEG check
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, mimeType: 'image/jpeg', sizeBytes: file.size };
    }

    // 2. PNG check
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { valid: true, mimeType: 'image/png', sizeBytes: file.size };
    }

    // 3. WebP check (RIFF at 0..3, WEBP at 8..11)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { valid: true, mimeType: 'image/webp', sizeBytes: file.size };
    }

    return {
      valid: false,
      error: 'Unsupported image format or invalid file header. Only authentic JPG, PNG, and WebP images are accepted.',
      sizeBytes: file.size,
    };
  } catch {
    return {
      valid: false,
      error: 'Unable to inspect binary file headers.',
      sizeBytes: file.size,
    };
  }
}

/**
 * Computes exact SHA-256 hex string for binary uniqueness verification.
 */
export async function computeContentHash(blob: Blob): Promise<string> {
  try {
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple checksum if SubtleCrypto fails
    return `fallback-${blob.size}-${blob.type}`;
  }
}

/**
 * Evaluates image quality from raw RGBA pixel data.
 * Pure mathematical function: testable in both browser Canvas and Node.js unit tests.
 */
export function analyzePixelQuality(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number
): ImageQualityReport {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return {
      brightness: 0,
      sharpness: 0,
      isDark: true,
      isBlurry: true,
      status: 'Too Dark',
      feedback: 'Empty or zero-dimensional image data.',
    };
  }

  let totalLuminance = 0;
  const grayscale = new Float32Array(totalPixels);

  // 1. Calculate luminance (standard ITU-R BT.601 formula)
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grayscale[i] = lum;
    totalLuminance += lum;
  }

  const avgLuminance = Math.round(totalLuminance / totalPixels);

  // 2. Darkness check (avg luminance < 32 or > 85% pixels under 20)
  let darkPixelCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (grayscale[i] < 20) darkPixelCount++;
  }
  const isDark = avgLuminance < 32 || darkPixelCount / totalPixels > 0.85;

  // 3. Sharpness calculation using discrete Laplacian edge filter
  // [  0, -1,  0 ]
  // [ -1,  4, -1 ]
  // [  0, -1,  0 ]
  let edgeSum = 0;
  let edgeSumSq = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const center = grayscale[idx];
      const top = grayscale[(y - 1) * width + x];
      const bottom = grayscale[(y + 1) * width + x];
      const left = grayscale[y * width + (x - 1)];
      const right = grayscale[y * width + (x + 1)];

      const lap = 4 * center - top - bottom - left - right;
      edgeSum += lap;
      edgeSumSq += lap * lap;
      edgeCount++;
    }
  }

  const lapMean = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const lapVariance = edgeCount > 0 ? edgeSumSq / edgeCount - lapMean * lapMean : 0;
  const sharpness = Math.round(lapVariance * 10) / 10;

  // Sharpness threshold: low variance indicates lack of sharp edges / out-of-focus
  // Note: if image is completely dark, blur is secondary to darkness
  const isBlurry = !isDark && sharpness < 25;

  let status: ImageQualityReport['status'] = 'Clear';
  let feedback = 'Image is clear and well-lit.';

  if (isDark) {
    status = 'Too Dark';
    feedback = 'Image appears very dark or unlit. Consider taking a photo in daylight or with flash enabled for clearer evaluation.';
  } else if (isBlurry) {
    status = 'Blurry';
    feedback = 'Image appears blurry or out of focus. Hold your camera steady to capture sharp details.';
  }

  return {
    brightness: avgLuminance,
    sharpness,
    isDark,
    isBlurry,
    status,
    feedback,
  };
}

/**
 * Generates 64-bit dHash (difference hash) from a 9x8 grayscale matrix.
 * Pure function: takes a 9-wide by 8-high grayscale array (72 numbers).
 */
export function computeDHashFromGrayscale(gray9x8: number[] | Float32Array): string {
  if (gray9x8.length < 72) {
    throw new Error('dHash requires exactly 72 grayscale values (9x8 matrix)');
  }

  let binaryStr = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray9x8[row * 9 + col];
      const right = gray9x8[row * 9 + col + 1];
      binaryStr += left > right ? '1' : '0';
    }
  }

  // Convert 64-bit binary string to 16 hex characters
  let hexStr = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = binaryStr.substring(i, i + 4);
    hexStr += parseInt(nibble, 2).toString(16);
  }

  return hexStr;
}

/**
 * Computes Hamming distance between two hex dHash strings (0..64 bit differences).
 */
export function computeHammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) {
    return 64;
  }

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Calculates visual similarity percentage from Hamming distance (0..64).
 */
export function calculateSimilarity(hammingDistance: number): number {
  const sim = ((64 - Math.min(64, Math.max(0, hammingDistance))) / 64) * 100;
  return Math.round(sim);
}

/**
 * Browser-side Canvas inspection: Decodes an image and calculates:
 * 1. Quality report (brightness, blur, status)
 * 2. 64-bit dHash perceptual fingerprint
 */
export async function inspectImageWithCanvas(
  fileOrBlob: Blob
): Promise<{ quality: ImageQualityReport; dHash: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        // --- 1. Quality Canvas (120x120 downsampled for efficient analysis) ---
        const qCanvas = document.createElement('canvas');
        qCanvas.width = 120;
        qCanvas.height = 120;
        const qCtx = qCanvas.getContext('2d');

        if (!qCtx) {
          throw new Error('Canvas 2D context unavailable');
        }

        qCtx.drawImage(img, 0, 0, 120, 120);
        const qImageData = qCtx.getImageData(0, 0, 120, 120);
        const quality = analyzePixelQuality(qImageData.data, 120, 120);

        // --- 2. Perceptual dHash Canvas (9x8 downsampled) ---
        const hCanvas = document.createElement('canvas');
        hCanvas.width = 9;
        hCanvas.height = 8;
        const hCtx = hCanvas.getContext('2d');

        if (!hCtx) {
          throw new Error('Canvas 2D context unavailable');
        }

        hCtx.drawImage(img, 0, 0, 9, 8);
        const hImageData = hCtx.getImageData(0, 0, 9, 8);
        const gray9x8 = new Float32Array(72);

        for (let i = 0; i < 72; i++) {
          const off = i * 4;
          gray9x8[i] =
            0.299 * hImageData.data[off] +
            0.587 * hImageData.data[off + 1] +
            0.114 * hImageData.data[off + 2];
        }

        const dHash = computeDHashFromGrayscale(gray9x8);

        resolve({ quality, dHash });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image into canvas.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Scans all existing complaints and images for duplicate / reused photographs.
 * Returns match details if Hamming distance <= 6 or exact SHA-256 match found.
 */
export function checkImageDuplicates(
  newDHash: string,
  newContentHash: string,
  existingImages: ImageAsset[],
  existingComplaints: Complaint[],
  currentComplaintId?: string
): ReusedPhotoMatch | null {
  // Threshold: Hamming distance <= 6 is ~90.6% visual match
  const HAMMING_THRESHOLD = 6;

  for (const asset of existingImages) {
    // Skip if belongs to the same complaint
    if (currentComplaintId && asset.complaintId === currentComplaintId) {
      continue;
    }

    // 1. Check exact SHA-256 match
    if (asset.contentHash && asset.contentHash === newContentHash) {
      const comp = existingComplaints.find((c) => c.id === asset.complaintId);
      return {
        matchedImageId: asset.id,
        matchedComplaintId: asset.complaintId,
        matchedComplaintReference: comp?.reference,
        similarityPercentage: 100,
        hammingDistance: 0,
        isExactMatch: true,
      };
    }

    // 2. Check perceptual dHash distance
    if (asset.perceptualHash) {
      const distance = computeHammingDistance(newDHash, asset.perceptualHash);
      if (distance <= HAMMING_THRESHOLD) {
        const similarity = calculateSimilarity(distance);
        const comp = existingComplaints.find((c) => c.id === asset.complaintId);
        return {
          matchedImageId: asset.id,
          matchedComplaintId: asset.complaintId,
          matchedComplaintReference: comp?.reference,
          similarityPercentage: similarity,
          hammingDistance: distance,
          isExactMatch: distance === 0,
        };
      }
    }
  }

  return null;
}

/**
 * Real Vision Model Classifier (Google Gemini API).
 * Strictly classifies into app categories or returns 'Uncertain' if ambiguous.
 * Transparent fallback when unconfigured.
 */
export async function classifyImageWithVisionModel(
  fileOrBlob: Blob,
  apiKey?: string
): Promise<VisualClassificationResult> {
  const activeKey = apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!activeKey || !activeKey.trim()) {
    return {
      category: 'Uncertain',
      explanation: 'Automated visual category detection is inactive (Gemini API key is not configured in Settings).',
      configured: false,
    };
  }

  try {
    // Convert Blob to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });

    const mimeType = fileOrBlob.type || 'image/jpeg';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey.trim()}`;

    const promptText = `
You are an image verification assistant for a gated residential community maintenance system.
Analyze this photo and classify it into EXACTLY ONE of the following maintenance categories:
- "Garbage" (accumulated waste, overflow trash cans, discarded rubbish)
- "Roads and Potholes" (potholes, damaged asphalt, cracked road, broken pavers)
- "Streetlights" (outdoor streetlights, pole lamps, pathway lighting)
- "Drainage" (blocked gutters, storm drains, sewage overflow, manhole issues)
- "Water Leakage" (burst pipes, leaking joints, water pooling from plumbing or valves)
- "Common-Area Electrical" (exposed wires, electrical panels, sparking meters, generator/lift issues)
- "Other" (other clear facility defects not fitting the above)
- "Uncertain" (CRITICAL: If the image is pitch dark, blurry, irrelevant, or if the failure cannot be verified from this photograph — such as a daytime photo of an unlit streetlight where bulb failure cannot be determined, or a normal wall where pipe leakage is claimed but not visible — you MUST output "Uncertain").

Respond strictly with valid JSON only, no markdown backticks, in this exact format:
{"category": "<CategoryName or Uncertain>", "explanation": "<1-2 sentence factual explanation of what is visually observed>"}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        category: 'Uncertain',
        explanation: 'Vision API returned an error. Verification unavailable.',
        configured: true,
        error: `HTTP ${response.status}: ${errText.slice(0, 100)}`,
      };
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown fences if present
    const cleanJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const validCategories: (ComplaintCategory | 'Uncertain')[] = [
      'Garbage',
      'Roads and Potholes',
      'Streetlights',
      'Drainage',
      'Water Leakage',
      'Common-Area Electrical',
      'Other',
      'Uncertain',
    ];

    const category = validCategories.includes(parsed.category)
      ? (parsed.category as ComplaintCategory | 'Uncertain')
      : 'Uncertain';

    return {
      category,
      explanation: parsed.explanation || 'Visual analysis completed.',
      configured: true,
    };
  } catch (err: any) {
    return {
      category: 'Uncertain',
      explanation: 'Failed to complete visual category classification.',
      configured: true,
      error: err?.message || 'Unknown network error',
    };
  }
}

/**
 * Compares resident's chosen category with vision model's output.
 */
export function compareSelectedWithVisualCategory(
  selectedCategory: ComplaintCategory,
  visualResult: VisualClassificationResult
): {
  status: 'Verified' | 'Mismatch' | 'Uncertain' | 'Unavailable';
  feedback: string;
  suggestedCategory?: ComplaintCategory;
} {
  if (!visualResult.configured) {
    return {
      status: 'Unavailable',
      feedback: 'Visual category verification is not configured.',
    };
  }

  if (visualResult.category === 'Uncertain') {
    return {
      status: 'Uncertain',
      feedback: visualResult.explanation || 'Issue condition could not be conclusively determined from photo.',
    };
  }

  if (visualResult.category === selectedCategory) {
    return {
      status: 'Verified',
      feedback: `Photo visually confirms ${selectedCategory}.`,
    };
  }

  return {
    status: 'Mismatch',
    suggestedCategory: visualResult.category,
    feedback: `The uploaded photo appears to show ${visualResult.category}, but you selected ${selectedCategory}. (${visualResult.explanation})`,
  };
}

/**
 * Heuristic screen/display photograph detector.
 * Identifies high-frequency periodic moiré artifacts, LCD scanline banding,
 * or extreme unnatural backlight characteristics commonly found when photographing
 * a monitor, laptop, or phone screen.
 *
 * NOTE: This is an uncertain review signal for human triage and does not definitively
 * prove fraud.
 */
export async function detectScreenOrDisplayArtifacts(
  fileOrBlob: Blob
): Promise<{ isScreenPhoto: boolean; score: number; details?: string }> {
  try {
    const bitmap = await createImageBitmap(fileOrBlob);
    const canvas = document.createElement('canvas');
    const sampleSize = 128;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { isScreenPhoto: false, score: 0 };
    }

    ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imgData.data;

    let alternatingRowDiff = 0;
    let blueDominanceCount = 0;
    let highFreqCount = 0;

    for (let y = 1; y < sampleSize - 1; y++) {
      for (let x = 1; x < sampleSize - 1; x++) {
        const idx = (y * sampleSize + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Backlight blue peak check
        if (b > r + 35 && b > g + 25 && (r + g + b) > 300) {
          blueDominanceCount++;
        }

        // Horizontal alternating row frequency (raster/scanline pattern)
        const topIdx = ((y - 1) * sampleSize + x) * 4;
        const bottomIdx = ((y + 1) * sampleSize + x) * 4;
        const lumCenter = 0.299 * r + 0.587 * g + 0.114 * b;
        const lumTop = 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
        const lumBottom = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];

        const rowStep = Math.abs(lumCenter * 2 - lumTop - lumBottom);
        if (rowStep > 40) {
          alternatingRowDiff++;
        }

        // Local high-contrast micro-edges indicative of pixel grids
        const leftIdx = (y * sampleSize + (x - 1)) * 4;
        const lumLeft = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
        if (Math.abs(lumCenter - lumLeft) > 55) {
          highFreqCount++;
        }
      }
    }

    const totalSamples = (sampleSize - 2) * (sampleSize - 2);
    const moireRatio = alternatingRowDiff / totalSamples;
    const blueRatio = blueDominanceCount / totalSamples;
    const highFreqRatio = highFreqCount / totalSamples;

    // Score combines periodic row banding, pixel grid edges, and display backlight signature
    const score = Math.min(100, Math.round((moireRatio * 200 + highFreqRatio * 100 + blueRatio * 150)));

    if (score >= 60) {
      return {
        isScreenPhoto: true,
        score,
        details: 'Potential computer or phone screen photograph detected (periodic scanline/moiré pattern). Flagged for reviewer inspection.',
      };
    }

    return {
      isScreenPhoto: false,
      score,
    };
  } catch (err) {
    console.warn('Screen detection heuristic error:', err);
    return { isScreenPhoto: false, score: 0 };
  }
}

/**
 * Builds suspicious flags for a complaint based on verification outcomes.
 */
export function buildSuspiciousFlags(params: {
  reusedMatch?: ReusedPhotoMatch | null;
  qualityReports?: ImageQualityReport[];
  categoryComparison?: ReturnType<typeof compareSelectedWithVisualCategory>;
  screenCheck?: { isScreenPhoto: boolean; details?: string };
  locationDiscrepancy?: { isDiscrepancy: boolean; distanceMeters: number };
}): SuspiciousFlag[] {
  const flags: SuspiciousFlag[] = [];

  // 1. Reused photo
  if (params.reusedMatch) {
    const { matchedComplaintReference, similarityPercentage, isExactMatch, matchedComplaintId, matchedImageId } =
      params.reusedMatch;
    flags.push({
      type: 'REUSED_PHOTO',
      severity: isExactMatch ? 'suspicious' : 'warning',
      details: isExactMatch
        ? `Identical photograph previously submitted in report ${matchedComplaintReference || 'CC-PREVIOUS'}.`
        : `Photographically similar image (${similarityPercentage}% match) found in report ${matchedComplaintReference || 'CC-PREVIOUS'}.`,
      matchedComplaintId,
      matchedComplaintReference,
      matchedImageId,
      similarityPercentage,
    });
  }

  // 2. Unusable image (pitch black or unusable)
  if (params.qualityReports) {
    const darkImages = params.qualityReports.filter((q) => q.isDark);
    if (darkImages.length > 0) {
      flags.push({
        type: 'UNUSABLE_IMAGE',
        severity: 'warning',
        details: 'Submitted photo is extremely dark or underexposed, making visual verification difficult.',
      });
    }
  }

  // 3. Category mismatch
  if (params.categoryComparison && params.categoryComparison.status === 'Mismatch') {
    flags.push({
      type: 'CATEGORY_MISMATCH',
      severity: 'warning',
      details: params.categoryComparison.feedback,
    });
  }

  // 4. Possible screen / display photo
  if (params.screenCheck && params.screenCheck.isScreenPhoto) {
    flags.push({
      type: 'POSSIBLE_SCREEN_PHOTO',
      severity: 'warning',
      details: params.screenCheck.details || 'Possible monitor or phone screen photograph detected (periodic scanline/moiré pattern).',
    });
  }

  // 5. Worker Location Discrepancy
  if (params.locationDiscrepancy && params.locationDiscrepancy.isDiscrepancy) {
    flags.push({
      type: 'LOCATION_DISCREPANCY',
      severity: 'warning',
      details: `Worker resolution photo was recorded ${Math.round(params.locationDiscrepancy.distanceMeters)}m away from reported complaint location.`,
    });
  }

  return flags;
}

