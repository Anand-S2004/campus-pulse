// Web location tracking hook.
// Polls the browser's Geolocation API every 5 min and posts to /api/public/ingest-location.
// Handles permission-denied / unsupported / timeout gracefully.
// Background sync via the Periodic Background Sync API (Chrome only, best-effort).
// NOTE: When the browser tab is closed, location updates stop. For continuous background
// tracking (even when device screen is off), use the companion Expo mobile app.
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LocationStatus =
  | "idle"
  | "requesting"
  | "tracking"
  | "denied"
  | "unsupported"
  | "error";

const POLL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "cp-location-tracking";
const LAST_ZONE_KEY = "cp-last-zone";

type GeoPosition = { latitude: number; longitude: number };

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [currentZone, setCurrentZone] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LAST_ZONE_KEY);
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pingServer = useCallback(async (coords: GeoPosition) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/public/ingest-location", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lat: coords.latitude, lon: coords.longitude }),
      });
      if (res.ok) {
        const j = await res.json();
        const zone = j.zone_name ?? null;
        setCurrentZone(zone);
        if (zone) localStorage.setItem(LAST_ZONE_KEY, zone);
        else localStorage.removeItem(LAST_ZONE_KEY);
        setLastPing(new Date().toLocaleTimeString());
      } else {
        const text = await res.text().catch(() => "unknown");
        console.warn("[location] ingest failed:", text);
      }
    } catch (e) {
      console.warn("[location] network error:", e);
    }
  }, []);

  const pingLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          await pingServer({ latitude: coords.latitude, longitude: coords.longitude });
          resolve();
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setLocationError(
              "Location access was denied. Enable it in your browser settings.",
            );
            setCurrentZone(null);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LAST_ZONE_KEY);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          resolve();
        },
        { timeout: 10000, maximumAge: 60000 },
      );
    });
  }, [pingServer]);

  const startTracking = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setLocationError("Your browser doesn't support location sharing.");
      return;
    }
    setStatus("requesting");
    setLocationError(null);

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          setStatus("tracking");
          localStorage.setItem(STORAGE_KEY, "1");
          await pingServer({ latitude: coords.latitude, longitude: coords.longitude });
          timerRef.current = setInterval(pingLocation, POLL_MS);
          try {
            if ("serviceWorker" in navigator) {
              const reg = await navigator.serviceWorker.ready;
              if ("periodicSync" in reg) {
                await (
                  reg as unknown as {
                    periodicSync: {
                      register: (tag: string, opts: object) => Promise<void>;
                    };
                  }
                ).periodicSync.register("cp-location-update", {
                  minInterval: POLL_MS,
                });
              }
            }
          } catch { /* not supported or permission denied */ }
          resolve();
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setLocationError(
              "Location access was denied. Enable it in your browser settings to share your zone.",
            );
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setStatus("error");
            setLocationError("Your location is unavailable right now.");
          } else {
            setStatus("error");
            setLocationError("Could not get your location. Please try again.");
          }
          resolve();
        },
        { timeout: 15000, enableHighAccuracy: false },
      );
    });
  }, [pingServer, pingLocation]);

  const stopTracking = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("idle");
    setCurrentZone(null);
    setLastPing(null);
    setLocationError(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_ZONE_KEY);
  }, []);

  // Auto-restart tracking if the user previously enabled it
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      startTracking();
    }
    const handleSwMsg = (e: MessageEvent) => {
      if (e.data?.type === "cp-location-update") {
        pingLocation();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMsg);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      navigator.serviceWorker?.removeEventListener("message", handleSwMsg);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, currentZone, locationError, lastPing, startTracking, stopTracking };
}
