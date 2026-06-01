import { useState, useCallback } from 'react';
import { isWithinSchool, SCHOOL_LOCATION } from '@/lib/utils';

interface GPSState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  distance: number | null;
  inRange: boolean;
  loading: boolean;
  error: string | null;
}

export function useGPS() {
  const [state, setState] = useState<GPSState>({
    lat: null,
    lng: null,
    accuracy: null,
    distance: null,
    inRange: false,
    loading: false,
    error: null,
  });

  const getCurrentPosition = useCallback((): Promise<GPSState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const errorState = {
          ...state,
          loading: false,
          error: 'อุปกรณ์นี้ไม่รองรับ GPS',
        };
        setState(errorState);
        resolve(errorState);
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const { inRange, distance } = isWithinSchool(latitude, longitude);

          const newState: GPSState = {
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            distance,
            inRange,
            loading: false,
            error: null,
          };
          setState(newState);
          resolve(newState);
        },
        (error) => {
          let msg = 'ไม่สามารถรับตำแหน่งได้';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'ไม่สามารถระบุตำแหน่งได้';
          } else if (error.code === error.TIMEOUT) {
            msg = 'หมดเวลารอตำแหน่ง';
          }
          const errorState: GPSState = {
            lat: null,
            lng: null,
            accuracy: null,
            distance: null,
            inRange: false,
            loading: false,
            error: msg,
          };
          setState(errorState);
          resolve(errorState);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  }, [state]);

  return {
    ...state,
    schoolLocation: SCHOOL_LOCATION,
    getCurrentPosition,
  };
}
