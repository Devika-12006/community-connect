/**
 * Geolocation calculation, distance verification, and coordinate formatting utilities.
 */

const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

/**
 * Calculates Great-Circle geodesic distance between two points using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Calculates effective distance accounting for the GPS accuracy margins of both readings.
 * Effective distance is zero if the accuracy circles overlap.
 */
export function calculateEffectiveDistance(
  rawDistanceMeters: number,
  accuracy1Meters: number = 0,
  accuracy2Meters: number = 0
): number {
  const totalMargin = Math.max(0, accuracy1Meters) + Math.max(0, accuracy2Meters);
  return Math.max(0, rawDistanceMeters - totalMargin);
}

export interface GeoPointWithAccuracy {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Checks whether worker completion photo location is within community tolerance of complaint location.
 * Supports both object parameter form and separate numeric parameter form.
 */
export function checkLocationDiscrepancy(
  workerPointOrLat: GeoPointWithAccuracy | number,
  complaintPointOrLng?: (GeoPointWithAccuracy | null) | number,
  workerAccuracyOrTolerance: number = 250,
  complaintLatArg?: number,
  complaintLngArg?: number,
  complaintAccuracyArg: number = 0,
  toleranceMetersArg: number = 250
): {
  isDiscrepancy: boolean;
  isDiscrepant: boolean;
  distanceMeters: number;
  effectiveDistanceMeters: number;
  details?: string;
  reason?: string;
} {
  let workerLat: number;
  let workerLng: number;
  let workerAccuracy: number;
  let complaintLat: number | undefined;
  let complaintLng: number | undefined;
  let complaintAccuracy: number;
  let toleranceMeters: number;

  if (typeof workerPointOrLat === 'object') {
    workerLat = workerPointOrLat.latitude;
    workerLng = workerPointOrLat.longitude;
    workerAccuracy = workerPointOrLat.accuracy || 0;

    if (!complaintPointOrLng || typeof complaintPointOrLng !== 'object') {
      return {
        isDiscrepancy: false,
        isDiscrepant: false,
        distanceMeters: 0,
        effectiveDistanceMeters: 0,
      };
    }

    complaintLat = complaintPointOrLng.latitude;
    complaintLng = complaintPointOrLng.longitude;
    complaintAccuracy = complaintPointOrLng.accuracy || 0;
    toleranceMeters = workerAccuracyOrTolerance || 250;
  } else {
    workerLat = workerPointOrLat;
    workerLng = complaintPointOrLng as number;
    workerAccuracy = workerAccuracyOrTolerance;
    complaintLat = complaintLatArg;
    complaintLng = complaintLngArg;
    complaintAccuracy = complaintAccuracyArg;
    toleranceMeters = toleranceMetersArg;
  }

  if (complaintLat === undefined || complaintLng === undefined) {
    return {
      isDiscrepancy: false,
      isDiscrepant: false,
      distanceMeters: 0,
      effectiveDistanceMeters: 0,
    };
  }

  const distanceMeters = calculateHaversineDistance(
    workerLat,
    workerLng,
    complaintLat,
    complaintLng
  );

  const effectiveDistanceMeters = calculateEffectiveDistance(
    distanceMeters,
    workerAccuracy,
    complaintAccuracy
  );

  const isDiscrepancy = effectiveDistanceMeters > toleranceMeters;

  let details: string | undefined;
  if (isDiscrepancy) {
    details = `Completion photo taken ~${distanceMeters}m from reported issue location (effective ~${effectiveDistanceMeters}m after ±${workerAccuracy}m GPS margin; tolerance: ${toleranceMeters}m).`;
  }

  return {
    isDiscrepancy,
    isDiscrepant: isDiscrepancy,
    distanceMeters,
    effectiveDistanceMeters,
    details,
    reason: details,
  };
}

/**
 * Validates coordinate limits (-90 <= lat <= 90, -180 <= lng <= 180).
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Validates location reading freshness against a maximum reading age.
 */
export function isLocationFresh(
  locationTimestamp: string | number,
  maxAgeSeconds: number = 60,
  referenceTimeMs: number = Date.now()
): boolean {
  const locTimeMs =
    typeof locationTimestamp === 'number'
      ? locationTimestamp
      : new Date(locationTimestamp).getTime();

  if (isNaN(locTimeMs)) return false;

  const ageSeconds = (referenceTimeMs - locTimeMs) / 1000;
  // Allow small negative threshold for slight clock skew (up to 5s)
  return ageSeconds >= -5 && ageSeconds <= maxAgeSeconds;
}

/**
 * Formats decimal latitude and longitude into human-readable directional coordinates.
 * Example: "12.9716° N, 77.5946° E"
 */
export function formatCoordinates(lat: number, lng: number, decimals: number = 5): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}° ${latDir}, ${Math.abs(lng).toFixed(decimals)}° ${lngDir}`;
}
