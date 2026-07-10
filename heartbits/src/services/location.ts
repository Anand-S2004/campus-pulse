import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK_NAME } from '../lib/config';
import { ingestLocation } from '../lib/api';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const first = locations?.[0];
  if (!first) {
    return;
  }

  try {
    await ingestLocation(first.coords.latitude, first.coords.longitude);
  } catch {
    // Intentionally silent so background work does not crash the app.
  }
});

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { foregroundGranted: false, backgroundGranted: false, enabled: false };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  const backgroundGranted = background.status === 'granted';

  return {
    foregroundGranted: true,
    backgroundGranted,
    enabled: backgroundGranted,
  };
}

export async function startBackgroundLocationTracking() {
  const permissions = await requestLocationPermissions();
  if (!permissions.foregroundGranted) {
    return permissions;
  }

  if (!permissions.backgroundGranted) {
    return permissions;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000,
    distanceInterval: 25,
    foregroundService: {
      notificationTitle: 'Campus Pulse',
      notificationBody: 'Keeping your campus zone updated quietly.',
    },
    pausesUpdatesAutomatically: true,
  });

  return { ...permissions, enabled: true };
}

export async function sendCurrentLocationOnce() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }

  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await ingestLocation(location.coords.latitude, location.coords.longitude);
  return true;
}

export async function getLocationPermissionStatus() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}
