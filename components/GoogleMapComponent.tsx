'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, Marker, Polyline, OverlayView } from '@react-google-maps/api';
import Image from 'next/image';
import { cloudflareLoader } from '@/lib/utils';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 35.2048,
  lng: 139.0253
};

interface GoogleMapComponentProps {
  places?: any[];
  photos?: any[];
  selectionMode?: boolean;
  defaultLat?: number;
  defaultLng?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function GoogleMapComponent({
  places = [],
  photos = [],
  selectionMode = false,
  defaultLat = defaultCenter.lat,
  defaultLng = defaultCenter.lng,
  onLocationSelect
}: GoogleMapComponentProps) {
  const [markerPos, setMarkerPos] = useState({ lat: defaultLat, lng: defaultLng });
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // Memoize initial center and zoom so GoogleMap doesn't constantly reset the view on re-renders
  const initialCenter = useMemo(() => ({ lat: defaultLat, lng: defaultLng }), [defaultLat, defaultLng]);
  const initialZoom = useMemo(() => selectionMode ? 14 : 9, [selectionMode]);

  useEffect(() => {
    if (selectionMode && mapInstance) {
      setMarkerPos({ lat: defaultLat, lng: defaultLng });
      mapInstance.panTo({ lat: defaultLat, lng: defaultLng });
    }
  }, [defaultLat, defaultLng, selectionMode, mapInstance]);

  const placesKey = places.map(p => p.id).join(',');

  // Fit bounds when places change or map loads
  useEffect(() => {
    if (!selectionMode && mapInstance && places.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;
      places.forEach(place => {
        if (place.lat && place.lng) {
          bounds.extend({ lat: place.lat, lng: place.lng });
          hasValidCoords = true;
        }
      });
      if (hasValidCoords) {
        // 使用 setTimeout 確保容器高度已經撐開再設定 bounds，避免初始加載時沒反應
        setTimeout(() => {
          const validPlaces = places.filter(p => p.lat && p.lng);
          if (validPlaces.length === 1) {
            mapInstance.setCenter({ lat: validPlaces[0].lat, lng: validPlaces[0].lng });
            mapInstance.setZoom(14);
          } else {
            mapInstance.fitBounds(bounds, {
              top: 50, right: 50, bottom: 50, left: 50
            });
          }
        }, 100);
      } else {
        // No places, fallback to default center
        mapInstance.setCenter(defaultCenter);
        mapInstance.setZoom(9);
      }
    }
  }, [placesKey, selectionMode, mapInstance]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (selectionMode && e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      if (onLocationSelect) {
        onLocationSelect(lat, lng);
      }
    }
  };

  const onMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      if (onLocationSelect) {
        onLocationSelect(lat, lng);
      }
    }
  };

  const polylineRef = useRef<google.maps.Polyline | null>(null);

  // Polyline coordinates for main mode
  const polylineCoords = places
    .filter(p => p.lat && p.lng)
    .map(p => ({ lat: p.lat, lng: p.lng }));

  // Manual Polyline rendering to fix react-google-maps/api unmount bugs
  useEffect(() => {
    if (selectionMode || !mapInstance) return;

    if (!polylineRef.current) {
      polylineRef.current = new window.google.maps.Polyline({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.6,
        strokeWeight: 5,
        map: mapInstance,
      });
    }

    if (polylineCoords.length > 1) {
      polylineRef.current.setPath(polylineCoords);
      polylineRef.current.setMap(mapInstance);
    } else {
      polylineRef.current.setMap(null);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [placesKey, selectionMode, mapInstance]);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={initialCenter}
      zoom={initialZoom}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      }}
      onClick={onMapClick}
      onLoad={onMapLoad}
    >
      {/* 選擇模式下的標記 */}
      {selectionMode && (
        <Marker
          position={markerPos}
          draggable={true}
          onDragEnd={onMarkerDragEnd}
        />
      )}

      {/* 主畫面模式：路徑改用手動 useEffect 管理 (避免殘留) */}


      {!selectionMode && places.map((place, index) => {
        if (!place.lat || !place.lng) return null;
        const placePhotos = photos.filter(p => p.place_id === place.id);
        const firstPhotoUrl = placePhotos.length > 0 ? placePhotos[0].url : undefined;
        
        return (
          <OverlayView
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(width, height) => ({
              x: -(width / 2),
              y: -height,
            })}
          >
            <div className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-50">
              {/* 名稱 Tooltip (Hover才顯示) */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg text-slate-800 text-xs font-bold">
                  {index + 1}. {place.name}
                </div>
              </div>

              {/* 圓形大頭針主體 */}
                {firstPhotoUrl ? (
                  <div className="w-7 h-7 rounded-full border-[1.5px] border-white shadow-md bg-white overflow-hidden relative">
                    <Image loader={cloudflareLoader} src={firstPhotoUrl} fill sizes="50px" className="object-cover" alt={place.name} />
                    <div className="absolute -top-[2px] -right-[2px] w-3.5 h-3.5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white shadow-sm z-10">
                    {index + 1}
                  </div>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-[1.5px] border-white shadow-md bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold relative">
                  {index + 1}
                </div>
              )}

              {/* 水滴狀尾巴 Pointer */}
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white drop-shadow-md -mt-[1px]"></div>
            </div>
          </OverlayView>
        );
      })}
    </GoogleMap>
  );
}
