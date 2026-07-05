import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LocationStatus =
  | "idle"
  | "requesting"
  | "tracking"
  | "denied"
  | "unsupported"
  | "error";

const POLL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "cp-location-tracking";

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const clearTrackingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    clearTrackingInterval();

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (!mountedRef.current) return;

    setStatus("idle");
    setCurrentZone(null);
  }, [clearTrackingInterval]);

  const sendLocation = useCallback(
    async (lat: number, lon: number) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          stopTracking();
          return;
        }

        const response = await fetch("/api/public/ingest-location", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            lat,
            lon,
          }),
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (!mountedRef.current) return;

        setCurrentZone(payload.zone_name ?? null);
      } catch {
        // Retry next cycle
      }
    },
    [stopTracking],
  );

  const pingLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      if (mountedRef.current) {
        setStatus("unsupported");
      }
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          await sendLocation(coords.latitude, coords.longitude);
          resolve();
        },
        (err) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }

          switch (err.code) {
            case err.PERMISSION_DENIED:
              setStatus("denied");
              setLocationError(
                "Location access was denied. Enable it in browser settings.",
              );
              setCurrentZone(null);

              clearTrackingInterval();

              if (typeof window !== "undefined") {
                localStorage.removeItem(STORAGE_KEY);
              }
              break;

            case err.POSITION_UNAVAILABLE:
              setLocationError(
                "Location information is currently unavailable.",
              );
              break;

            case err.TIMEOUT:
              setLocationError(
                "Location request timed out. Will retry automatically.",
              );
              break;

            default:
              setLocationError(
                "Could not retrieve location.",
              );
          }

          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 2 * 60 * 1000,
        },
      );
    });
  }, [clearTrackingInterval, sendLocation]);

  const startPolling = useCallback(() => {
    clearTrackingInterval();

    intervalRef.current = setInterval(() => {
      pingLocation();
    }, POLL_MS);
  }, [clearTrackingInterval, pingLocation]);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    setLocationError(null);

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }

          setStatus("tracking");

          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, "1");
          }

          await sendLocation(
            coords.latitude,
            coords.longitude,
          );

          startPolling();

          try {
            if ("serviceWorker" in navigator) {
              const registration =
                await navigator.serviceWorker.ready;

              const periodicSync =
                (registration as any).periodicSync;

              if (
                periodicSync &&
                typeof periodicSync.register === "function"
              ) {
                await periodicSync.register(
                  "cp-location-update",
                  {
                    minInterval: POLL_MS,
                  },
                );
              }
            }
          } catch {
            // Ignore unsupported browsers
          }

          resolve();
        },
        (err) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }

          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied");
            setLocationError(
              "Location access denied. Enable it in browser settings.",
            );
          } else {
            setStatus("error");
            setLocationError(
              "Could not obtain location.",
            );
          }

          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        },
      );
    });
  }, [sendLocation, startPolling]);

  useEffect(() => {
    mountedRef.current = true;

    if (
      typeof window !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "1"
    ) {
      startTracking();
    }

    const visibilityHandler = () => {
      if (
        document.visibilityState === "visible" &&
        localStorage.getItem(STORAGE_KEY) === "1"
      ) {
        pingLocation();
      }
    };

    const onlineHandler = () => {
      if (
        localStorage.getItem(STORAGE_KEY) === "1"
      ) {
        pingLocation();
      }
    };

    const serviceWorkerHandler = (e: MessageEvent) => {
      if (e.data?.type === "cp-location-update") {
        pingLocation();
      }
    };

    document.addEventListener(
      "visibilitychange",
      visibilityHandler,
    );

    window.addEventListener(
      "online",
      onlineHandler,
    );

    navigator.serviceWorker?.addEventListener(
      "message",
      serviceWorkerHandler,
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          stopTracking();
        }
      },
    );

    if (
      navigator.permissions &&
      navigator.permissions.query
    ) {
      navigator.permissions
        .query({
          name: "geolocation" as PermissionName,
        })
        .then((permission) => {
          permission.onchange = () => {
            if (
              permission.state === "denied"
            ) {
              stopTracking();
              setStatus("denied");
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      mountedRef.current = false;

      clearTrackingInterval();

      subscription.unsubscribe();

      document.removeEventListener(
        "visibilitychange",
        visibilityHandler,
      );

      window.removeEventListener(
        "online",
        onlineHandler,
      );

      navigator.serviceWorker?.removeEventListener(
        "message",
        serviceWorkerHandler,
      );
    };
  }, [
    startTracking,
    pingLocation,
    stopTracking,
    clearTrackingInterval,
  ]);

  return {
    status,
    currentZone,
    locationError,
    startTracking,
    stopTracking,
  };
}