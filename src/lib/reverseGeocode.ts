/**
 * Privacy-safe reverse geocoding utility.
 * Fetches real reverse-geocoded addresses via OpenStreetMap Nominatim.
 * Strictly returns null on failure or offline — never fabricates address strings.
 */

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  timeoutMs: number = 4000
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || !data.display_name) {
      return null;
    }

    // Build a clean, concise address from parts if available
    const addr = data.address;
    if (addr) {
      const parts: string[] = [];
      if (addr.road || addr.pedestrian || addr.path) parts.push(addr.road || addr.pedestrian || addr.path);
      if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
      if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    return (data.display_name as string).split(',').slice(0, 3).join(',').trim();
  } catch {
    clearTimeout(timer);
    return null;
  }
}
