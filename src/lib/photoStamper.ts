import type { GeoLocationData } from '../types';
import { formatCoordinates } from './geoUtils';

export interface PhotoStampOptions {
  communityName?: string;
  reference?: string;
}

/**
 * Creates an authorized stamped copy of the captured photo with high-contrast
 * geographic and verification metadata overlay.
 * Preserves the original raw evidence photo untouched.
 */
export async function generateStampedPhoto(
  originalBlob: Blob,
  geo: GeoLocationData,
  options: PhotoStampOptions = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(originalBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        const width = img.naturalWidth || 1280;
        const height = img.naturalHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }

        // 1. Draw raw evidence image
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Format location, timestamp, and branding
        const coordsText = formatCoordinates(geo.latitude, geo.longitude);
        const accuracyText = `Accuracy: ±${Math.round(geo.accuracy)} m`;
        const dateObj = new Date(geo.clientCaptureTimestamp || geo.locationTimestamp);
        const timeZoneStr = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const dateText = `${dateObj.toLocaleString()} (${timeZoneStr})`;
        const brandText = options.communityName
          ? `COMMUNITY CONNECT • ${options.communityName.toUpperCase()} • LIVE CAPTURE`
          : 'COMMUNITY CONNECT • VERIFIED LIVE CAPTURE';

        // 3. Compute plaque sizing proportional to image resolution
        const scaleFactor = Math.max(1, width / 1200);
        const fontSize = Math.round(14 * scaleFactor);
        const headerFontSize = Math.round(15 * scaleFactor);
        const lineHeight = Math.round(20 * scaleFactor);
        const padding = Math.round(16 * scaleFactor);

        const lines = [
          `GPS: ${coordsText}  •  ${accuracyText}`,
          `Recorded: ${dateText}`,
        ];

        if (geo.address) {
          lines.push(`Address: ${geo.address}`);
        }

        const bannerHeight = padding * 2 + headerFontSize + lines.length * lineHeight;

        // 4. Render dark gradient backdrop for crystal-clear readability
        ctx.save();
        const gradient = ctx.createLinearGradient(0, height - bannerHeight - 20, 0, height);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
        gradient.addColorStop(0.2, 'rgba(15, 23, 42, 0.85)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - bannerHeight - 20, width, bannerHeight + 20);

        // Accent border
        ctx.fillStyle = '#0f766e'; // Deep Teal
        ctx.fillRect(0, height - bannerHeight - 20, width, Math.max(2, 3 * scaleFactor));

        // 5. Draw text
        let yPos = height - bannerHeight + padding;

        // Brand badge / header
        ctx.font = `bold ${headerFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`;
        ctx.fillStyle = '#2dd4bf'; // Teal-400
        ctx.fillText(brandText, padding, yPos);
        yPos += lineHeight;

        // Metadata details
        ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.fillStyle = '#f8fafc'; // Slate-50

        for (const line of lines) {
          ctx.fillText(line, padding, yPos);
          yPos += lineHeight;
        }

        ctx.restore();

        // 6. Export as stamped copy blob
        canvas.toBlob(
          (stampedBlob) => {
            if (stampedBlob) {
              resolve(stampedBlob);
            } else {
              reject(new Error('Failed to create stamped blob from canvas'));
            }
          },
          'image/jpeg',
          0.92
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for stamping'));
    };

    img.src = objectUrl;
  });
}
