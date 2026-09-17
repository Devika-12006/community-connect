import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateEffectiveDistance,
  checkLocationDiscrepancy,
  isValidCoordinate,
  isLocationFresh,
  formatCoordinates,
} from './geoUtils';

describe('geoUtils suite', () => {
  describe('calculateHaversineDistance', () => {
    it('calculates 0 distance for identical coordinates', () => {
      const dist = calculateHaversineDistance(12.9716, 77.5946, 12.9716, 77.5946);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between two points', () => {
      // Bangalore City Hall (12.97194, 77.59369) to Cubbon Park (12.9763, 77.5929) ~490m
      const dist = calculateHaversineDistance(12.97194, 77.59369, 12.9763, 77.5929);
      expect(dist).toBeGreaterThan(450);
      expect(dist).toBeLessThan(550);
    });
  });

  describe('calculateEffectiveDistance', () => {
    it('subtracts accuracy margins safely', () => {
      const dist = calculateEffectiveDistance(100, 20, 30);
      expect(dist).toBe(50); // 100 - 50 = 50
    });

    it('clamps effective distance to 0 when margins exceed raw distance', () => {
      const dist = calculateEffectiveDistance(30, 25, 25);
      expect(dist).toBe(0); // 30 - 50 clamped to 0
    });
  });

  describe('checkLocationDiscrepancy', () => {
    it('reports no discrepancy when issue coordinates are absent', () => {
      const check = checkLocationDiscrepancy({ latitude: 12.9716, longitude: 77.5946 }, null);
      expect(check.isDiscrepancy).toBe(false);
      expect(check.distanceMeters).toBe(0);
    });

    it('reports no discrepancy within acceptable tolerance radius', () => {
      // 50m separation with 250m tolerance
      const worker = { latitude: 12.9716, longitude: 77.5946, accuracy: 10 };
      const issue = { latitude: 12.9719, longitude: 77.5948, accuracy: 10 };
      const check = checkLocationDiscrepancy(worker, issue, 250);
      expect(check.isDiscrepancy).toBe(false);
    });

    it('flags location discrepancy when beyond community tolerance', () => {
      // ~2.5km separation with 250m tolerance
      const worker = { latitude: 12.9900, longitude: 77.6100, accuracy: 15 };
      const issue = { latitude: 12.9700, longitude: 77.5900, accuracy: 15 };
      const check = checkLocationDiscrepancy(worker, issue, 250);
      expect(check.isDiscrepancy).toBe(true);
      expect(check.distanceMeters).toBeGreaterThan(2000);
      expect(check.reason).toContain('tolerance');
    });
  });

  describe('isValidCoordinate', () => {
    it('validates standard GPS coordinates', () => {
      expect(isValidCoordinate(12.9716, 77.5946)).toBe(true);
      expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
    });

    it('rejects coordinates exceeding latitude limits (-90 to 90)', () => {
      expect(isValidCoordinate(91.5, 77.5946)).toBe(false);
      expect(isValidCoordinate(-90.1, 77.5946)).toBe(false);
    });

    it('rejects coordinates exceeding longitude limits (-180 to 180)', () => {
      expect(isValidCoordinate(12.9716, 181)).toBe(false);
      expect(isValidCoordinate(12.9716, -180.5)).toBe(false);
    });

    it('rejects NaN, undefined, or infinite coordinates', () => {
      expect(isValidCoordinate(NaN, 77.5946)).toBe(false);
      expect(isValidCoordinate(12.9716, Infinity)).toBe(false);
    });
  });

  describe('isLocationFresh', () => {
    it('accepts recent timestamps', () => {
      const now = Date.now();
      const readingTime = now - 15000; // 15 seconds ago
      expect(isLocationFresh(readingTime, 60, now)).toBe(true);
    });

    it('rejects stale timestamps exceeding max allowed age', () => {
      const now = Date.now();
      const readingTime = now - 90000; // 90 seconds ago (max 60s)
      expect(isLocationFresh(readingTime, 60, now)).toBe(false);
    });

    it('rejects future timestamps beyond clock drift margin', () => {
      const now = Date.now();
      const readingTime = now + 60000; // 60 seconds into future
      expect(isLocationFresh(readingTime, 60, now)).toBe(false);
    });
  });

  describe('formatCoordinates', () => {
    it('formats positive and negative lat/long with compass directions', () => {
      const formatted = formatCoordinates(12.9716, 77.5946, 4);
      expect(formatted).toBe('12.9716° N, 77.5946° E');

      const southWest = formatCoordinates(-33.8688, -70.6693, 4);
      expect(southWest).toBe('33.8688° S, 70.6693° W');
    });
  });
});
