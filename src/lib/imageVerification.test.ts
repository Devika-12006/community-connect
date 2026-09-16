import { describe, it, expect } from 'vitest';
import {
  validateImageBytes,
  analyzePixelQuality,
  computeDHashFromGrayscale,
  computeHammingDistance,
  calculateSimilarity,
  checkImageDuplicates,
  compareSelectedWithVisualCategory,
  buildSuspiciousFlags,
} from './imageVerification';
import type { Complaint, ImageAsset } from '../types';

describe('imageVerification engine', () => {
  describe('validateImageBytes (Binary Magic Header Validation)', () => {
    it('accepts valid JPEG magic bytes', async () => {
      // JPEG magic: FF D8 FF E0 ...
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const result = await validateImageBytes(blob);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('accepts valid PNG magic bytes', async () => {
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
      const blob = new Blob([bytes], { type: 'image/png' });
      const result = await validateImageBytes(blob);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/png');
    });

    it('accepts valid WebP magic bytes', async () => {
      // WebP magic: 'RIFF' + 4 bytes size + 'WEBP'
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20,
      ]);
      const blob = new Blob([bytes], { type: 'image/webp' });
      const result = await validateImageBytes(blob);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/webp');
    });

    it('rejects disguised executables or text files', async () => {
      // Executable header: MZ (4D 5A)
      const fakeExeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]);
      const blob = new Blob([fakeExeBytes], { type: 'image/jpeg' });
      const result = await validateImageBytes(blob);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported image format or invalid file header');
    });

    it('rejects files exceeding the 5MB size limit', async () => {
      // Allocate > 5MB buffer
      const hugeBuffer = new Uint8Array(5 * 1024 * 1024 + 100);
      hugeBuffer[0] = 0xff;
      hugeBuffer[1] = 0xd8;
      hugeBuffer[2] = 0xff;
      const blob = new Blob([hugeBuffer], { type: 'image/jpeg' });
      const result = await validateImageBytes(blob);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the maximum allowed limit of 5 MB');
    });
  });

  describe('analyzePixelQuality (Canvas Darkness & Blur Analysis)', () => {
    it('detects pitch black or underexposed photos', () => {
      const width = 10;
      const height = 10;
      // All black pixels (RGBA: 0, 0, 0, 255)
      const blackPixels = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        blackPixels[i * 4 + 3] = 255; // Alpha
      }

      const report = analyzePixelQuality(blackPixels, width, height);
      expect(report.isDark).toBe(true);
      expect(report.status).toBe('Too Dark');
      expect(report.feedback).toContain('Image appears very dark or unlit');
    });

    it('detects sharp, well-lit images', () => {
      const width = 12;
      const height = 12;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Create alternating sharp checkerboard pattern with good brightness (180 vs 80)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const val = (x + y) % 2 === 0 ? 180 : 80;
          pixels[idx] = val;
          pixels[idx + 1] = val;
          pixels[idx + 2] = val;
          pixels[idx + 3] = 255;
        }
      }

      const report = analyzePixelQuality(pixels, width, height);
      expect(report.isDark).toBe(false);
      expect(report.isBlurry).toBe(false);
      expect(report.status).toBe('Clear');
    });

    it('detects blurry or flat, low-contrast images', () => {
      const width = 10;
      const height = 10;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Completely flat gray (no edges, completely out of focus)
      for (let i = 0; i < width * height; i++) {
        pixels[i * 4] = 120;
        pixels[i * 4 + 1] = 120;
        pixels[i * 4 + 2] = 120;
        pixels[i * 4 + 3] = 255;
      }

      const report = analyzePixelQuality(pixels, width, height);
      expect(report.isDark).toBe(false);
      expect(report.isBlurry).toBe(true);
      expect(report.status).toBe('Blurry');
    });
  });

  describe('dHash Perceptual Hashing & Hamming Distance', () => {
    it('produces identical dHash for identical inputs with Hamming distance 0', () => {
      // 9x8 grayscale matrix (72 values)
      const matrix = new Float32Array(72);
      for (let i = 0; i < 72; i++) {
        matrix[i] = (i * 3) % 256;
      }

      const hash1 = computeDHashFromGrayscale(matrix);
      const hash2 = computeDHashFromGrayscale(matrix);

      expect(hash1).toBe(hash2);
      expect(computeHammingDistance(hash1, hash2)).toBe(0);
      expect(calculateSimilarity(0)).toBe(100);
    });

    it('calculates expected Hamming distance and similarity', () => {
      // 'ffffffffffffffff' vs '0000000000000000' -> 64 bit difference
      const distMax = computeHammingDistance('ffffffffffffffff', '0000000000000000');
      expect(distMax).toBe(64);
      expect(calculateSimilarity(distMax)).toBe(0);

      // 'ffffffffffffffff' vs 'fffffffffffffffe' -> exactly 1 bit difference
      const dist1 = computeHammingDistance('ffffffffffffffff', 'fffffffffffffffe');
      expect(dist1).toBe(1);
      expect(calculateSimilarity(dist1)).toBe(98);
    });
  });

  describe('checkImageDuplicates (Cross-Complaint Duplicate Detection)', () => {
    const existingImages: ImageAsset[] = [
      {
        id: 'img-1',
        complaintId: 'comp-101',
        blob: new Blob([]),
        mimeType: 'image/jpeg',
        originalName: 'pothole.jpg',
        size: 1024,
        createdAt: '2026-09-14T10:00:00Z',
        perceptualHash: '1234567890abcdef',
        contentHash: 'hash-sha256-exact-match',
      },
    ];

    const complaints: Complaint[] = [
      {
        id: 'comp-101',
        reference: 'CC-2026-001',
        residentId: 'res-1',
        residentName: 'Aarav Patel',
        residentBlock: 'Block A',
        title: 'Pothole near Gate 1',
        description: 'Deep road cavity',
        category: 'Roads and Potholes',
        block: 'Block A',
        specificLocation: 'Gate 1',
        priority: 'Low',
        status: 'In Progress',
        originalImageIds: ['img-1'],
        createdAt: '2026-09-14T10:00:00Z',
        updatedAt: '2026-09-14T10:00:00Z',
      },
    ];

    it('detects exact binary match via contentHash', () => {
      const match = checkImageDuplicates(
        'different_dhash_11',
        'hash-sha256-exact-match',
        existingImages,
        complaints
      );
      expect(match).not.toBeNull();
      expect(match?.matchedComplaintReference).toBe('CC-2026-001');
      expect(match?.similarityPercentage).toBe(100);
      expect(match?.isExactMatch).toBe(true);
    });

    it('detects perceptual match within Hamming distance <= 6', () => {
      // 2-bit difference from '1234567890abcdef'
      // change 'f' (1111) to 'c' (1100) -> 2 bit difference
      const similarHash = '1234567890abcdec';
      const match = checkImageDuplicates(
        similarHash,
        'random-sha256',
        existingImages,
        complaints
      );
      expect(match).not.toBeNull();
      expect(match?.matchedComplaintReference).toBe('CC-2026-001');
      expect(match?.hammingDistance).toBeLessThanOrEqual(6);
      expect(match?.similarityPercentage).toBeGreaterThanOrEqual(90);
    });

    it('ignores completely distinct images with large Hamming distance', () => {
      const totallyDifferentHash = 'fedcba0987654321';
      const match = checkImageDuplicates(
        totallyDifferentHash,
        'unique-sha256',
        existingImages,
        complaints
      );
      expect(match).toBeNull();
    });
  });

  describe('compareSelectedWithVisualCategory & buildSuspiciousFlags', () => {
    it('returns Verified when visual detection matches user category', () => {
      const comparison = compareSelectedWithVisualCategory('Garbage', {
        category: 'Garbage',
        explanation: 'Clear pile of household trash bags.',
        configured: true,
      });
      expect(comparison.status).toBe('Verified');
    });

    it('returns Mismatch when photo shows a different issue', () => {
      const comparison = compareSelectedWithVisualCategory('Water Leakage', {
        category: 'Garbage',
        explanation: 'Accumulated trash containers visible.',
        configured: true,
      });
      expect(comparison.status).toBe('Mismatch');
      expect(comparison.suggestedCategory).toBe('Garbage');
      expect(comparison.feedback).toContain('appears to show Garbage');
    });

    it('returns Uncertain when visual model indicates failure cannot be determined', () => {
      const comparison = compareSelectedWithVisualCategory('Streetlights', {
        category: 'Uncertain',
        explanation: 'Daytime photo of streetlight pole; bulb operational failure cannot be verified in daylight.',
        configured: true,
      });
      expect(comparison.status).toBe('Uncertain');
    });

    it('returns Unavailable when vision model is unconfigured', () => {
      const comparison = compareSelectedWithVisualCategory('Drainage', {
        category: 'Uncertain',
        explanation: 'Automated visual category detection is inactive.',
        configured: false,
      });
      expect(comparison.status).toBe('Unavailable');
    });

    it('builds proper SuspiciousFlag array', () => {
      const flags = buildSuspiciousFlags({
        reusedMatch: {
          matchedImageId: 'img-1',
          matchedComplaintId: 'comp-1',
          matchedComplaintReference: 'CC-2026-001',
          similarityPercentage: 100,
          hammingDistance: 0,
          isExactMatch: true,
        },
        qualityReports: [
          {
            brightness: 10,
            sharpness: 2,
            isDark: true,
            isBlurry: true,
            status: 'Too Dark',
          },
        ],
        categoryComparison: {
          status: 'Mismatch',
          suggestedCategory: 'Roads and Potholes',
          feedback: 'Photo shows road asphalt cracks.',
        },
      });

      expect(flags).toHaveLength(3);
      expect(flags.some((f) => f.type === 'REUSED_PHOTO')).toBe(true);
      expect(flags.some((f) => f.type === 'UNUSABLE_IMAGE')).toBe(true);
      expect(flags.some((f) => f.type === 'CATEGORY_MISMATCH')).toBe(true);
    });
  });
});
