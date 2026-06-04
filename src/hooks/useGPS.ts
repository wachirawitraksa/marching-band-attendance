import { useState, useCallback } from 'react';
import { haversineDistance } from '@/lib/utils';
import { useGPSSettings } from './useGPSSettings';

interface GPSState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  distance: number | null;
  inRange: boolean;
  loading: boolean;
  error: string | null;
}

const defaultState: GPSState = {
  lat: null,
  lng: null,
  accuracy: null,
  distance: null,
  inRange: false,
  loading: false,
  error: null,
};

const GPS_CACHE_DURATION_MS = 5 * 60 * 1000; // เก็บผล GPS ไว้ 5 นาที เพื่อไม่ให้ต้องสแกนใหม่ทุกครั้ง
let cachedGPSState: GPSState = defaultState;
let cachedGPSCheckedAt: number | null = null;

const DEFAULT_SCHOOL_LOCATION = {
  lat: 18.7784475,
  lng: 100.780098,
  name: 'ห้องดนตรี',
  allowedRadius: 200,
};

export function useGPS() {
  const [state, setState] = useState<GPSState>(defaultState);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const { settings } = useGPSSettings();

  const schoolLocation = settings
    ? {
        lat: settings.latitude,
        lng: settings.longitude,
        name: settings.name,
        allowedRadius: settings.allowed_radius,
      }
    : DEFAULT_SCHOOL_LOCATION;

  const isWithinSchool = (lat: number, lng: number, accuracy?: number) => {
    const distance = haversineDistance(lat, lng, schoolLocation.lat, schoolLocation.lng);
    const adjustedInRange =
      distance <= schoolLocation.allowedRadius ||
      (accuracy ? distance - accuracy <= schoolLocation.allowedRadius : false);

    return {
      inRange: adjustedInRange,
      distance: Math.round(distance),
    };
  };

  const getCurrentPosition = useCallback((forceRefresh = false): Promise<GPSState> => {
    return new Promise(async (resolve) => {
      const now = Date.now();
      const canUseCache = !forceRefresh && cachedGPSState.lat !== null && cachedGPSState.lng !== null && cachedGPSCheckedAt !== null && now - cachedGPSCheckedAt <= GPS_CACHE_DURATION_MS;
      if (canUseCache) {
        setState(cachedGPSState);
        setLastCheckedAt(cachedGPSCheckedAt);
        resolve(cachedGPSState);
        return;
      }

      if (!navigator.geolocation) {
        const result: GPSState = { ...defaultState, error: 'อุปกรณ์นี้ไม่รองรับ GPS' };
        setState(result);
        resolve(result);
        return;
      }

      // If the browser already denied geolocation, return a helpful error immediately.
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (permission.state === 'denied') {
            const result: GPSState = {
              ...defaultState,
              error: 'กรุณาอนุญาตการเข้าถึงตำแหน่งจากการตั้งค่าเบราว์เซอร์ แล้วลองใหม่อีกครั้ง',
            };
            setState(result);
            resolve(result);
            return;
          }
        } catch {
          // Ignore permissions API failures and continue to request location.
        }
      }

      setState({ ...defaultState, loading: true });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const { inRange, distance } = isWithinSchool(latitude, longitude, accuracy);
          const result: GPSState = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy ? Math.round(accuracy) : null,
            distance,
            inRange,
            loading: false,
            error: null,
          };
          setState(result);
          setLastCheckedAt(Date.now());
          cachedGPSState = result;
          cachedGPSCheckedAt = Date.now();
          resolve(result);
        },
        (err) => {
          let msg = 'ไม่สามารถรับตำแหน่งได้';
          if (err.code === err.PERMISSION_DENIED) msg = 'กรุณาอนุญาตการเข้าถึงตำแหน่งจากเบราว์เซอร์';
          if (err.code === err.POSITION_UNAVAILABLE) msg = 'ไม่สามารถระบุตำแหน่งได้';
          if (err.code === err.TIMEOUT) msg = 'หมดเวลารอตำแหน่ง';
          const result: GPSState = { ...defaultState, error: msg };
          setState(result);
          resolve(result);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    });
  }, [schoolLocation, state, lastCheckedAt]);

  return {
    ...state,
    schoolLocation,
    getCurrentPosition,
  };
}