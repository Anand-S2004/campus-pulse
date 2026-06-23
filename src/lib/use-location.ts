// Web location tracking hook.
// Polls the browser's Geolocation API every 5 min and posts to /api/public/ingest-location.
// Handles permission-denied gracefully — never crashes, just degrades to 'denied' state.
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

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pingLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session) return resolve();
            const res = await fetch("/api/public/ingest-location", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                lat: coords.latitude,
                lon: coords.longitude,
              }),
            });
            if (res.ok) {
              const j = await res.json();
              setCurrentZone(j.zone_name ?? null);
            }
          } catch {
            // Network error — keep tracking, will retry next poll
          }
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
  }, []);

  const startTracking = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    setLocationError(null);

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          setStatus("tracking");
          localStorage.setItem(STORAGE_KEY, "1");

          // Immediate first ping
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              const res = await fetch("/api/public/ingest-location", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  lat: coords.latitude,
                  lon: coords.longitude,
                }),
              });
              if (res.ok) {
                const j = await res.json();
                setCurrentZone(j.zone_name ?? null);
              }
            }
          } catch { /* ignore */ }

          // Poll every 5 min while the tab is open
          timerRef.current = setInterval(pingLocation, POLL_MS);

          // Register Background Periodic Sync (Chrome only — best-effort)
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
          } else {
            setStatus("error");
            setLocationError(
              "Could not get your location. Please try again.",
            );
          }
          resolve();
        },
        { timeout: 15000 },
      );
    });
  }, [pingLocation]);

  const stopTracking = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("idle");
    setCurrentZone(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Auto-restart tracking if the user previously enabled it
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      startTracking();
    }
    // Listen for periodic sync wakeups from the service worker
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

  return { status, currentZone, locationError, startTracking, stopTracking };
}
