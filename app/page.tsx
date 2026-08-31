'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Edit2, Plus, MapPin, UploadCloud, X, Save, MoreVertical, Image as ImageIcon, Navigation, Info, Maximize2, ChevronDown, ChevronUp, Loader2, GripVertical, ChevronLeft, ChevronRight, Search, Sparkles, FolderOpen, Camera, Settings, Clock, Grid, Play, Paperclip, FileText, Map, Music, VolumeX } from 'lucide-react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { useJsApiLoader } from '@react-google-maps/api';
import exifr from 'exifr';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import imageCompression from 'browser-image-compression';

const GoogleMapComponent = dynamic(() => import('../components/GoogleMapComponent'), { ssr: false });

const libraries: any[] = [];

const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const isVideo = (url: string) => /\.(mp4|mov|webm)$/i.test(url || '');

export default function TravelMapApp() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [tripPlans, setTripPlans] = useState<any[]>([]);
  const [isTripPlansModalOpen, setIsTripPlansModalOpen] = useState(false);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  
  const getAuthHeaders = (extraHeaders: any = {}) => {
    let token = localStorage.getItem('adminToken');
    if (!token) {
      token = prompt('安全驗證：請輸入管理員密碼以執行此操作 (API_SECRET_KEY)');
      if (token) localStorage.setItem('adminToken', token);
    }
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      ...extraHeaders
    };
  };
  
  // Modals state
  const [isAddTripModalOpen, setIsAddTripModalOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripStartDate, setNewTripStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTripEndDate, setNewTripEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [editTripData, setEditTripData] = useState<any>(null);

  const [isSlideshowSettingsOpen, setIsSlideshowSettingsOpen] = useState(false);
  const [slideshowConfig, setSlideshowConfig] = useState({ speed: 3.5, playFullVideo: true, order: 'random' });
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
  const [slideshowMedia, setSlideshowMedia] = useState<any[]>([]);
  const [currentSlideshowIndex, setCurrentSlideshowIndex] = useState(0);

  // 展開/收合狀態
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [isTripListExpanded, setIsTripListExpanded] = useState(true);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<any | null>(null);
  const [placeFormData, setPlaceFormData] = useState({ name: '', lat: 35.2048, lng: 139.0253, description: '' });
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Photo Edit Modal
  const [isPhotoEditModalOpen, setIsPhotoEditModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
  const [photoEditDesc, setPhotoEditDesc] = useState('');
  const [photoEditPlaceId, setPhotoEditPlaceId] = useState('');
  
  // --- 新增：管理模式與檢視模式 ---
  const [isManageMode, setIsManageMode] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<any[]>([]);
  const [lightboxDescInput, setLightboxDescInput] = useState('');
  const [lightboxScale, setLightboxScale] = useState(1);

  const [musicList, setMusicList] = useState<any[]>([]);
  const [isGlobalMusicOn, setIsGlobalMusicOn] = useState(false);
  const [isSlideshowMuted, setIsSlideshowMuted] = useState(false);
  const [currentMusicUrl, setCurrentMusicUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchTrips();
    fetchMusic();
  }, []);

  const fetchMusic = async () => {
    try {
      const res = await fetch('/api/music');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setMusicList(json.data);
      }
    } catch (err) {
      console.error('載入音樂失敗', err);
    }
  };

  const playRandomMusic = () => {
    if (musicList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * musicList.length);
    setCurrentMusicUrl(musicList[randomIndex].url);
  };

  useEffect(() => {
    const shouldPlay = isGlobalMusicOn || (isSlideshowOpen && !isSlideshowMuted);
    if (shouldPlay) {
      if (!currentMusicUrl && musicList.length > 0) {
        playRandomMusic();
      } else if (currentMusicUrl && audioRef.current) {
        audioRef.current.play().catch(e => console.error('Audio play error:', e));
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isGlobalMusicOn, isSlideshowOpen, isSlideshowMuted, currentMusicUrl, musicList]);

  // Handle auto-play when currentMusicUrl changes
  useEffect(() => {
    if (currentMusicUrl && audioRef.current && (isGlobalMusicOn || isSlideshowOpen)) {
      audioRef.current.play().catch(e => console.error('Audio play error:', e));
    }
  }, [currentMusicUrl]);


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSlideshowOpen && slideshowMedia.length > 0) {
      const currentMedia = slideshowMedia[currentSlideshowIndex];
      const isCurrentVideo = isVideo(currentMedia?.url);
      
      if (!(isCurrentVideo && slideshowConfig.playFullVideo)) {
        interval = setInterval(() => {
          setCurrentSlideshowIndex((prev) => (prev + 1) % slideshowMedia.length);
        }, slideshowConfig.speed * 1000);
      }
    }
    return () => clearInterval(interval);
  }, [isSlideshowOpen, slideshowMedia, currentSlideshowIndex, slideshowConfig.speed, slideshowConfig.playFullVideo]);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setTrips(json.data);
        if (!selectedTrip) setSelectedTrip(json.data[0]);
      }
    } catch (err) {
      console.error('載入旅程失敗', err);
    }
  };

  useEffect(() => {
    if (selectedTrip) {
      setPlaces([]); // 切換旅程時先清空舊景點，避免殘留或重疊
      setPhotos([]);
      setTripPlans([]);
      fetchPlaces(selectedTrip.id);
      fetchTripPlans(selectedTrip.id);
    }
  }, [selectedTrip]);

  const fetchTripPlans = async (tripId: string | number) => {
    if (!tripId) return;
    try {
      const res = await fetch(`/api/trip_plans?trip_id=${tripId}`);
      const json = await res.json();
      if (json.success) {
        setTripPlans(json.data || []);
      }
    } catch (err) {
      console.error('載入行程附件失敗', err);
    }
  };

  const fetchPlaces = async (tripId: string | number) => {
    if (!tripId) return;
    try {
      const res = await fetch(`/api/places?trip_id=${tripId}`);
      const json = await res.json();
      if (json.success) {
        setPlaces(json.data || []);
        const placeIds = json.data.map((p: any) => p.id);
        fetchAllPhotos(placeIds);
      }
    } catch (err) {
      console.error('載入景點失敗', err);
    }
  };

  const fetchAllPhotos = async (placeIds: any[]) => {
    if (!placeIds || placeIds.length === 0) {
      setPhotos([]);
      return;
    }
    try {
      const res = await fetch(`/api/photos?place_ids=${placeIds.join(',')}`);
      const json = await res.json();
      if (json.success) {
        setPhotos(json.data || []);
      }
    } catch (err) {
      console.error('載入所有照片失敗', err);
    }
  };

  const handleCreateTrip = async (e: any) => {
    e.preventDefault();
    if (!newTripName.trim()) return;
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: newTripName, start_date: newTripStartDate, end_date: newTripEndDate })
      });
      const json = await res.json();
      if (json.success) {
        setNewTripName('');
        setIsAddTripModalOpen(false);
        fetchTrips();
        setSelectedTrip(json.data);
      }
    } catch (err) {
      console.error('新增旅程錯誤', err);
    }
  };

  const handleEditTrip = async (e: any) => {
    e.preventDefault();
    if (!editTripData?.name.trim()) return;
    try {
      const res = await fetch('/api/trips', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: editTripData.id, name: editTripData.name, start_date: editTripData.start_date, end_date: editTripData.end_date })
      });
      const json = await res.json();
      if (json.success) {
        setIsEditTripModalOpen(false);
        fetchTrips();
        if (selectedTrip?.id === editTripData.id) {
          setSelectedTrip(json.data);
        }
      }
    } catch (err) {
      console.error('修改旅程錯誤', err);
    }
  };

  const handleDeleteTrip = async (id: any) => {
    if (!confirm('確定要刪除這個旅程與其所有資料嗎？這將無法復原。')) return;
    try {
      const res = await fetch(`/api/trips?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success) {
        setIsEditTripModalOpen(false);
        setSelectedTrip(null);
        fetchTrips();
      }
    } catch (err) {
      console.error('刪除旅程錯誤', err);
    }
  };

  const handleSearchLocation = async () => {
    if (!placeFormData.name) return;
    setSearchingLocation(true);
    try {
      if (!window.google) {
        alert('Google 地圖尚未載入，請稍後再試');
        setSearchingLocation(false);
        return;
      }
      
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: placeFormData.name }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const location = results[0].geometry.location;
          setPlaceFormData(prev => ({ 
            ...prev, 
            lat: location.lat(), 
            lng: location.lng() 
          }));
        } else {
          alert('找不到該地點，請嘗試輸入更完整的名稱');
        }
        setSearchingLocation(false);
      });
    } catch (err) {
      console.error('搜尋地點失敗', err);
      setSearchingLocation(false);
    }
  };



  const handleSavePlace = async (e: any) => {
    e.preventDefault();
    if (!selectedTrip || !placeFormData.name.trim()) return;
    try {
      if (editingPlace) {
        const res = await fetch('/api/places', {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            id: editingPlace.id,
            name: placeFormData.name,
            description: placeFormData.description,
            lat: parseFloat(String(placeFormData.lat)),
            lng: parseFloat(String(placeFormData.lng)),
            order_index: editingPlace.order_index
          })
        });
        const json = await res.json();
        if (json.success) {
          fetchPlaces(selectedTrip.id);
          setIsPlaceModalOpen(false);
        }
      } else {
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            trip_id: selectedTrip.id,
            name: placeFormData.name,
            description: placeFormData.description,
            lat: parseFloat(String(placeFormData.lat)),
            lng: parseFloat(String(placeFormData.lng)),
            order_index: places.length + 1
          })
        });
        const json = await res.json();
        if (json.success) {
          fetchPlaces(selectedTrip.id);
          setIsPlaceModalOpen(false);
        }
      }
    } catch (err) {
      console.error('儲存景點錯誤', err);
    }
  };

  const handleDeletePlace = async (id: any) => {
    if (!confirm('確定要刪除這個景點嗎？')) return;
    try {
      const res = await fetch(`/api/places?id=${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success && selectedTrip) {
        fetchPlaces(selectedTrip.id);
      }
    } catch (err) {
      console.error('刪除景點錯誤', err);
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const normalPlaces = places.filter(p => p.name !== '未分配照片區');
    
    const newPlaces = Array.from(normalPlaces);
    const [removed] = newPlaces.splice(sourceIndex, 1);
    newPlaces.splice(destinationIndex, 0, removed);

    const updatedPlaces = newPlaces.map((p, idx) => ({
      ...p,
      order_index: idx + 1
    }));

    // Optimistic UI update
    setPlaces([...updatedPlaces, ...places.filter(p => p.name === '未分配照片區')]);

    try {
      for (const place of updatedPlaces) {
        await fetch('/api/places', {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(place)
        });
      }
    } catch (err) {
      console.error('更新順序失敗', err);
    }
  };

  const handleMultiplePhotoUpload = async (e: any, placeId: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const filesArray = Array.from(files) as any[];
      const chunks = chunkArray(filesArray, 3); // 每次同時處理 3 張照片，兼顧速度與穩定性
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (file: any) => {
          // 1. Get Presigned URL for original
          const ext = file.name.split('.').pop() || 'jpg';
          const urlRes = await fetch(`/api/photos/upload-url?contentType=${file.type}&extension=${ext}`, {
            headers: getAuthHeaders()
          });
          const urlData = await urlRes.json();
          
          if (!urlData.success) throw new Error('無法取得原圖上傳網址');

          // 2. Upload original directly to R2
          await fetch(urlData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
          });

          // 3. Compress for thumbnail
          let thumbnailUrl = null;
          try {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 800,
              useWebWorker: true,
              initialQuality: 0.85
            };
            const compressedFile = await imageCompression(file, options);
            const thumbExt = compressedFile.name.split('.').pop() || 'webp';
            const thumbUrlRes = await fetch(`/api/photos/upload-url?contentType=${compressedFile.type}&extension=${thumbExt}`, {
              headers: getAuthHeaders()
            });
            const thumbUrlData = await thumbUrlRes.json();
            
            if (thumbUrlData.success) {
              await fetch(thumbUrlData.uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': compressedFile.type },
                body: compressedFile
              });
              thumbnailUrl = thumbUrlData.publicUrl;
            }
          } catch (error) {
            console.error('縮圖壓縮或上傳失敗', error);
          }

          // 4. Parse EXIF to get photo time (no GPS assignment needed here)
          let photoTime = new Date().toISOString();
          try {
            const exif = await exifr.parse(file);
            if (exif && exif.DateTimeOriginal) {
              photoTime = new Date(exif.DateTimeOriginal).toISOString();
            }
          } catch(err) {
            console.log('No EXIF time');
          }

          // 5. Save to database using a generic assign route
          await fetch('/api/photos/smart-assign', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              trip_id: selectedTrip?.id,
              photoUrl: urlData.publicUrl,
              thumbnailUrl: thumbnailUrl,
              photoTime,
              override_place_id: placeId
            })
          });
        }));
      }

      if (selectedTrip) fetchPlaces(selectedTrip.id);
    } catch (err) {
      console.error('批次上傳照片錯誤', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSmartUpload = async (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedTrip) return;

    setUploading(true);
    try {
      const filesArray = Array.from(files) as any[];
      const chunks = chunkArray(filesArray, 3); // 每次同時處理 3 張照片
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (file: any) => {
          // 1. 解析 EXIF
          let gpsLat = null;
          let gpsLng = null;
          let photoTime = new Date().toISOString();
          
          try {
            const exif = await exifr.parse(file);
            if (exif) {
              if (exif.latitude && exif.longitude) {
                gpsLat = exif.latitude;
                gpsLng = exif.longitude;
              }
              if (exif.DateTimeOriginal) {
                photoTime = new Date(exif.DateTimeOriginal).toISOString();
              }
            }
          } catch(err) {
            console.log('EXIF parse error', err);
          }

          // 2. 取得 Presigned URL for original
          const ext = file.name.split('.').pop() || 'jpg';
          const urlRes = await fetch(`/api/photos/upload-url?contentType=${file.type}&extension=${ext}`, {
            headers: getAuthHeaders()
          });
          const urlData = await urlRes.json();
          
          if (!urlData.success) throw new Error('無法取得原圖上傳網址');

          // 3. 直傳原圖檔案到 Cloudflare R2
          await fetch(urlData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
          });

          // 4. Compress for thumbnail
          let thumbnailUrl = null;
          try {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 800,
              useWebWorker: true,
              initialQuality: 0.85
            };
            const compressedFile = await imageCompression(file, options);
            const thumbExt = compressedFile.name.split('.').pop() || 'webp';
            const thumbUrlRes = await fetch(`/api/photos/upload-url?contentType=${compressedFile.type}&extension=${thumbExt}`, {
              headers: getAuthHeaders()
            });
            const thumbUrlData = await thumbUrlRes.json();
            
            if (thumbUrlData.success) {
              await fetch(thumbUrlData.uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': compressedFile.type },
                body: compressedFile
              });
              thumbnailUrl = thumbUrlData.publicUrl;
            }
          } catch (error) {
            console.error('縮圖壓縮或上傳失敗', error);
          }

          // 5. 通知後端寫入 DB 並自動分配景點
          await fetch('/api/photos/smart-assign', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              trip_id: selectedTrip.id,
              photoUrl: urlData.publicUrl,
              thumbnailUrl: thumbnailUrl,
              gpsLat,
              gpsLng,
              photoTime
            })
          });
        }));
      }

      fetchPlaces(selectedTrip.id);
    } catch (err) {
      console.error('智慧上傳照片錯誤', err);
      alert('上傳失敗: ' + (err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePlanUpload = async (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedTrip) return;

    setUploadingPlan(true);
    try {
      const filesArray = Array.from(files) as any[];
      for (const file of filesArray) {
        // 1. Get Presigned URL
        const ext = file.name.split('.').pop() || 'tmp';
        const urlRes = await fetch(`/api/photos/upload-url?contentType=${file.type || 'application/octet-stream'}&extension=${ext}`, {
          headers: getAuthHeaders()
        });
        const urlData = await urlRes.json();
        
        if (!urlData.success) throw new Error('無法取得上傳網址');

        // 2. Upload directly to R2
        await fetch(urlData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        });

        // 3. Save to database
        await fetch('/api/trip_plans', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            trip_id: selectedTrip.id,
            appendix: file.name,
            url: urlData.publicUrl
          })
        });
      }
      fetchTripPlans(selectedTrip.id);
    } catch (err) {
      console.error('上傳附件失敗', err);
      alert('上傳失敗: ' + (err as Error).message);
    } finally {
      setUploadingPlan(false);
      e.target.value = '';
    }
  };

  const handlePlanDelete = async (planId: any) => {
    if (!confirm('確定要刪除這個附件嗎？')) return;
    try {
      const res = await fetch(`/api/trip_plans?id=${planId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success && selectedTrip) {
        fetchTripPlans(selectedTrip.id);
      }
    } catch (err) {
      console.error('刪除附件錯誤', err);
    }
  };

  const handleReassignPhoto = async (photo: any, newPlaceId: any) => {
    try {
      await fetch('/api/photos', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...photo, place_id: newPlaceId })
      });
      if (selectedTrip) fetchPlaces(selectedTrip.id);
    } catch (err) {
      console.error('重新分配照片錯誤', err);
    }
  };

  const handleSavePhotoDesc = async (photo: any, newDesc: string, newPlaceId: string) => {
    try {
      await fetch('/api/photos', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...photo, description: newDesc, place_id: newPlaceId })
      });
      if (selectedTrip) fetchPlaces(selectedTrip.id);
    } catch (err) {
      console.error('儲存照片描述錯誤', err);
    }
  };

  const handleDeletePhoto = async (photoId: any) => {
    if (!confirm('確定要刪除這張照片嗎？')) return;
    try {
      const res = await fetch(`/api/photos?id=${photoId}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success && selectedTrip) fetchPlaces(selectedTrip.id);
    } catch (err) {
      console.error('刪除照片錯誤', err);
    }
  };

  const openLightbox = (placeId: any, index: number) => {
    const pPhotos = photos.filter(p => p.place_id === placeId);
    setLightboxPhotos(pPhotos);
    setCurrentPhotoIndex(index);
    setLightboxDescInput(pPhotos[index]?.description || '');
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = () => {
    const nextIdx = (currentPhotoIndex + 1) % lightboxPhotos.length;
    setCurrentPhotoIndex(nextIdx);
    setLightboxDescInput(lightboxPhotos[nextIdx]?.description || '');
  };

  const prevPhoto = () => {
    const prevIdx = (currentPhotoIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    setCurrentPhotoIndex(prevIdx);
    setLightboxDescInput(lightboxPhotos[prevIdx]?.description || '');
  };

  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = lightboxRef.current;
    if (!lightboxOpen || !el || lightboxPhotos.length === 0) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastSwipeTime = 0;

    const handleStart = (clientX: number, clientY: number) => {
      startX = clientX;
      startY = clientY;
      startTime = Date.now();
    };

    const handleEnd = (clientX: number, clientY: number) => {
      if (Date.now() - lastSwipeTime < 300) return; // Prevent double trigger from both touch and pointer

      const diffX = startX - clientX;
      const diffY = startY - clientY;
      const timeDiff = Date.now() - startTime;
      const velocityX = Math.abs(diffX) / timeDiff;

      if ((Math.abs(diffX) > 40 || velocityX > 0.4) && Math.abs(diffX) > Math.abs(diffY) * 1.5 && lightboxScale <= 1.05) {
        if (diffX > 0) nextPhoto();
        else prevPhoto();
        lastSwipeTime = Date.now();
      }
    };

    const onTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return; // Ignore mouse click/drag for this swipe
      handleStart(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      handleEnd(e.clientX, e.clientY);
    };

    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    el.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    el.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true });
      el.removeEventListener('touchend', onTouchEnd, { capture: true });
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      el.removeEventListener('pointerup', onPointerUp, { capture: true });
    };
  }, [lightboxOpen, lightboxScale, lightboxPhotos, currentPhotoIndex]);
  const normalPlaces = useMemo(() => places.filter(p => p.name !== '未分配照片區'), [places]);
  const unassignedPlace = useMemo(() => places.find(p => p.name === '未分配照片區'), [places]);

  return (
    <>
      {/* 隱藏的背景音樂播放器 */}
      <audio 
        ref={audioRef} 
        src={currentMusicUrl} 
        onEnded={playRandomMusic}
        preload="auto"
      />
      <main className="flex flex-col md:flex-row h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden pt-[env(safe-area-inset-top)]">
      
      {/* 左半邊：地圖 + 旅程列表 (20% 寬度) */}
      <section className="flex flex-col w-full md:w-1/5 flex-none md:flex-auto md:h-full border-b md:border-b-0 md:border-r border-slate-200">
        


        <div className={`order-2 md:order-1 ${isMapExpanded ? 'h-[40vh]' : 'h-0 hidden'} md:h-auto md:flex-[3] relative bg-slate-200 z-0 transition-all duration-300`}>
          {isLoaded ? (
            <GoogleMapComponent places={normalPlaces} photos={photos} selectionMode={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">Google 地圖載入中...</div>
          )}
        </div>
        <div className="order-1 md:order-2 flex-none md:flex-1 bg-slate-50 shadow-sm z-20 md:z-10 border-t-0 md:border-t border-slate-200">
          <div className="px-3 py-2.5 md:p-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-30">
            <h2 
              className="flex-1 font-bold text-[15px] md:text-lg text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition truncate min-w-0 pr-2"
              onClick={() => setIsTripListExpanded(!isTripListExpanded)}
              title="點擊展開/收合旅程列表"
            >
              <Navigation className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />
              <span className="truncate">{selectedTrip?.name || '我的旅程'}</span>
              {isTripListExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {/* 手機版：精簡第一層與更多選單 (iOS Style) */}
              <div className="flex md:hidden items-center gap-2 shrink-0">
                <button 
                  onClick={() => setIsGlobalMusicOn(!isGlobalMusicOn)}
                  className={`p-2 rounded-full transition shrink-0 ${isGlobalMusicOn ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-700'}`}
                  title="背景音樂"
                >
                  {isGlobalMusicOn ? <Music className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className={`p-2 rounded-full transition shrink-0 ${isMapExpanded ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}
                  title="地圖預覽"
                >
                  <Map className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setEditingPlace(null);
                    setPlaceFormData({ name: '', lat: 35.2048, lng: 139.0253, description: '' });
                    setIsPlaceModalOpen(true);
                  }}
                  disabled={!selectedTrip}
                  className="p-2 bg-slate-800 text-white rounded-full disabled:opacity-50 hover:bg-slate-700 transition"
                  title="新增景點"
                >
                  <MapPin className="w-5 h-5" />
                </button>
                
                {/* 更多選項選單 */}
                <div className="relative">
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={`p-2 rounded-full transition ${isMobileMenuOpen ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    title="更多選項"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {isMobileMenuOpen && (
                    <>
                      {/* 背景遮罩 (點擊關閉選單) */}
                      <div className="fixed inset-0 z-40" onClick={() => setIsMobileMenuOpen(false)}></div>
                      {/* 下拉選單 */}
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white/95 backdrop-blur-md rounded-xl shadow-lg shadow-black/10 border border-slate-200 py-2 z-50 flex flex-col">
                        <button
                          onClick={() => { setIsSlideshowSettingsOpen(true); setIsMobileMenuOpen(false); }}
                          disabled={!selectedTrip || photos.length === 0}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          <Play className="w-5 h-5 text-pink-600" />
                          <span>播放幻燈片</span>
                        </button>
                        <label className={`flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer ${uploading || !selectedTrip ? 'opacity-40 pointer-events-none' : ''}`}>
                          {uploading ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> : <Sparkles className="w-5 h-5 text-indigo-600" />}
                          <span>智慧上傳照片</span>
                          <input type="file" accept="image/*,video/*" multiple onChange={(e) => { handleSmartUpload(e); setIsMobileMenuOpen(false); }} disabled={uploading || !selectedTrip} className="hidden" />
                        </label>
                        <div className="h-px bg-slate-100 my-1 mx-3"></div>
                        <button
                          onClick={() => { setIsTripPlansModalOpen(true); setIsMobileMenuOpen(false); }}
                          disabled={!selectedTrip}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          <Paperclip className="w-5 h-5 text-slate-500" />
                          <span>行程附件</span>
                        </button>
                        <button
                          onClick={() => { 
                            setEditTripData({ id: selectedTrip.id, name: selectedTrip.name, start_date: selectedTrip.start_date ? new Date(selectedTrip.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], end_date: selectedTrip.end_date ? new Date(selectedTrip.end_date).toISOString().split('T')[0] : '' });
                            setIsEditTripModalOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          disabled={!selectedTrip}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          <Edit2 className="w-5 h-5 text-slate-500" />
                          <span>編輯目前旅程</span>
                        </button>
                        <div className="h-px bg-slate-100 my-1 mx-3"></div>
                        <button
                          onClick={() => { setIsManageMode(!isManageMode); setIsMobileMenuOpen(false); }}
                          disabled={!selectedTrip}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          <Settings className="w-5 h-5 text-amber-600" />
                          <span>批次管理照片</span>
                        </button>
                        <button
                          onClick={() => { setViewMode(prev => prev === 'card' ? 'timeline' : 'card'); setIsMobileMenuOpen(false); }}
                          disabled={!selectedTrip}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          {viewMode === 'card' ? <Clock className="w-5 h-5 text-slate-500" /> : <Grid className="w-5 h-5 text-slate-500" />}
                          <span>切換為{viewMode === 'card' ? '時光軸' : '卡片'}模式</span>
                        </button>
                        <div className="h-px bg-slate-100 my-1 mx-3"></div>
                        <button
                          onClick={() => { setIsAddTripModalOpen(true); setIsMobileMenuOpen(false); }}
                          className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                        >
                          <Plus className="w-5 h-5 text-blue-600" />
                          <span>新增其他旅程</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <button onClick={() => setIsAddTripModalOpen(true)} className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition shadow-sm shrink-0 hidden md:block" title="新增旅程">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
          {/* 行程橫向/直向滾動區塊 */}
          <div className={`transition-all duration-300 ${isTripListExpanded ? 'opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>
            <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-2 gap-2 md:p-2">
              {trips.map(trip => (
                <div 
                  key={trip.id}
                  onClick={() => {
                    setSelectedTrip(trip);
                    if (window.innerWidth < 768) setIsTripListExpanded(false); // 手機版選擇後自動收合
                  }}
                  className={`flex-none w-48 md:w-auto p-3 md:p-4 rounded-xl cursor-pointer transition border ${selectedTrip?.id === trip.id ? 'bg-white border-blue-300 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'}`}
                >
                  <div className={`font-bold ${selectedTrip?.id === trip.id ? 'text-blue-700' : 'text-slate-800'}`}>{trip.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(trip.start_date || trip.created_at).toLocaleDateString()}
                    {trip.end_date && ` - ${new Date(trip.end_date).toLocaleDateString()}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 右半邊：景點與照片列表 (80% 寬度) */}
      <aside className="flex-1 flex flex-col w-full md:w-4/5 h-full bg-slate-50 z-10 min-h-0">
        
        <div className="hidden md:flex p-4 md:p-6 border-b border-slate-200 bg-white justify-between items-center shadow-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">{selectedTrip?.name || '請選擇旅程'}</h1>
              {selectedTrip && (
                <button 
                  onClick={() => {
                    setEditTripData({ id: selectedTrip.id, name: selectedTrip.name, start_date: selectedTrip.start_date ? new Date(selectedTrip.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
                    setIsEditTripModalOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                  title="編輯旅程"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">規劃您的精彩景點與回憶</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsGlobalMusicOn(!isGlobalMusicOn)}
              className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${isGlobalMusicOn ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title="全域背景音樂"
            >
              {isGlobalMusicOn ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{isGlobalMusicOn ? '音樂播放中' : '開啟音樂'}</span>
            </button>
            <button 
              onClick={() => setViewMode(prev => prev === 'card' ? 'timeline' : 'card')}
              disabled={!selectedTrip}
              className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition disabled:opacity-50"
              title="切換瀏覽模式"
            >
              {viewMode === 'card' ? <Clock className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              <span>{viewMode === 'card' ? '時光軸模式' : '卡片模式'}</span>
            </button>
            <button
              onClick={() => setIsSlideshowSettingsOpen(true)}
              disabled={!selectedTrip || photos.length === 0}
              className="hidden md:flex items-center gap-2 px-3 py-2 bg-pink-50 text-pink-700 rounded-lg font-medium hover:bg-pink-100 transition disabled:opacity-50"
              title="製作隨機短影音播放"
            >
              <Play className="w-4 h-4" />
              <span>播放幻燈片</span>
            </button>
            <button
              onClick={() => setIsTripPlansModalOpen(true)}
              disabled={!selectedTrip}
              className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition disabled:opacity-50"
              title="檢視行程附件"
            >
              <Paperclip className="w-4 h-4" />
              <span>行程附件</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition cursor-pointer disabled:opacity-50" title="上傳照片並自動分配到最近的景點">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="hidden md:inline">{uploading ? '智慧上傳中...' : '智慧上傳照片'}</span>
              <input type="file" accept="image/*,video/*" multiple onChange={handleSmartUpload} disabled={uploading || !selectedTrip} className="hidden" />
            </label>
            <button 
              onClick={() => setIsManageMode(!isManageMode)}
              disabled={!selectedTrip}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${isManageMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title="批次管理照片"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">{isManageMode ? '完成管理' : '管理照片'}</span>
            </button>
            <button 
              onClick={() => {
                setEditingPlace(null);
                setPlaceFormData({ name: '', lat: 35.2048, lng: 139.0253, description: '' });
                setIsPlaceModalOpen(true);
              }}
              disabled={!selectedTrip}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">新增景點</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-2 md:p-6 space-y-4 md:space-y-8">
          
          {/* 未分配照片區塊 */}
          {unassignedPlace && photos.filter(p => p.place_id === unassignedPlace.id).length > 0 && (
            <div className="bg-orange-50/50 rounded-2xl border border-orange-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-orange-800">
                <FolderOpen className="w-5 h-5" />
                <h3 className="font-bold text-lg">未分配照片區</h3>
                <span className="text-xs font-medium px-2 py-1 bg-orange-200 rounded-full">需手動分配</span>
              </div>
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-thin scrollbar-thumb-orange-200">
                {photos.filter(p => p.place_id === unassignedPlace.id).map((photo, pIndex) => (
                  <div key={photo.id} className="snap-start shrink-0 w-[75vw] sm:w-56 md:w-64 lg:w-72 relative group">
                    <div 
                      className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 cursor-pointer relative shadow-sm"
                      onClick={() => openLightbox(unassignedPlace.id, pIndex)}
                    >
                      {isVideo(photo.url) ? (
                        <video src={photo.url} className="w-full h-full object-cover" muted loop playsInline onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                      ) : (
                        <img loading="lazy" src={photo.thumbnail_url || photo.url} alt="未分配" className="w-full h-full object-cover" />
                      )}
                    </div>
                    {/* 分配下拉選單 */}
                    <select 
                      className="absolute bottom-2 left-2 right-2 text-xs p-1.5 rounded bg-white/90 backdrop-blur shadow outline-none cursor-pointer"
                      value=""
                      onChange={(e) => handleReassignPhoto(photo, e.target.value)}
                    >
                      <option value="" disabled>分配至...</option>
                      {normalPlaces.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => handleDeletePhoto(photo.id)}
                      className={`absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500 transition-all z-10 ${isManageMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 md:opacity-100'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 正常景點區塊 */}
          {viewMode === 'card' ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="places-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                  {normalPlaces.map((place, index) => (
                    <Draggable key={place.id} draggableId={String(place.id)} index={index}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-white rounded-2xl border transition p-3 md:p-6 shadow-sm ${snapshot.isDragging ? 'shadow-lg border-blue-400 ring-2 ring-blue-100 z-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-start gap-3 w-full">
                              <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab mt-1 shrink-0">
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5 shrink-0">
                                {index + 1}
                              </span>
                              <div 
                                className="group cursor-pointer rounded-lg -ml-2 p-2 hover:bg-slate-50 transition flex-1 min-w-0"
                                onClick={() => {
                                  setEditingPlace(place);
                                  setPlaceFormData({ name: place.name, description: place.description || '', lat: place.lat, lng: place.lng });
                                  setIsPlaceModalOpen(true);
                                }}
                                title="點擊編輯景點與遊記"
                              >
                                <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition flex items-center gap-2 truncate">
                                  {place.name}
                                  <Edit2 className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                </h3>
                                <div className="hidden md:flex text-xs text-slate-400 items-center gap-1 mt-0.5 mb-2 truncate">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{place.lat.toFixed(4)}, {place.lng.toFixed(4)}</span>
                                </div>
                                {/* 景點遊記顯示 */}
                                {place.description && (
                                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-2xl mt-1 break-words">
                                    {place.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 照片展示區：橫向捲動 */}
                          {photos.filter(p => p.place_id === place.id).length > 0 && (
                            <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 md:gap-4 pb-2 scrollbar-thin scrollbar-thumb-slate-200 mt-4">
                              {photos.filter(p => p.place_id === place.id).map((photo, pIndex) => (
                                <div key={photo.id} className="snap-start shrink-0 w-full sm:w-[26rem] md:w-[28rem] relative group flex flex-col">
                                  <div 
                                    className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 cursor-pointer relative shadow-sm"
                                    onClick={() => openLightbox(place.id, pIndex)}
                                  >
                                    {isVideo(photo.url) ? (
                                      <video src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" muted loop playsInline onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                                    ) : (
                                      <img 
                                        loading="lazy"
                                        src={photo.thumbnail_url || photo.url} 
                                        alt={photo.description || '景點照片'} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition"></div>
                                  </div>
                                  
                                  <div className={`absolute top-2 right-2 flex flex-col gap-2 transition-all z-10 ${isManageMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setEditingPhoto(photo); 
                                        setPhotoEditDesc(photo.description || ''); 
                                        setPhotoEditPlaceId(photo.place_id || '');
                                        setIsPhotoEditModalOpen(true); 
                                      }}
                                      className="p-1.5 bg-black/50 text-white rounded-full hover:bg-blue-500 transition-all"
                                      title="編輯照片描述"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                                      className="p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500 transition-all"
                                      title="刪除照片"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {photo.description && (
                                    <div className="mt-2 text-sm text-slate-600 font-medium px-2 flex-1 flex flex-col">
                                      <span className="line-clamp-2" title={photo.description}>{photo.description}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                    {normalPlaces.length === 0 && (
                      <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                        <MapPin className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">目前尚無景點，點擊上方按鈕開始規劃</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent pt-4">
              {normalPlaces.map((place, index) => {
                const placePhotos = photos.filter(p => p.place_id === place.id);
                if (placePhotos.length === 0 && !place.description) return null; // 隱藏空景點
                return (
                  <div key={place.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* 中間的圈圈節點 */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-blue-100 text-blue-700 text-sm font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {index + 1}
                    </div>
                    
                    {/* 內容卡片 */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 md:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <h3 className="font-bold text-slate-800 text-lg">{place.name}</h3>
                      </div>
                      
                      {place.description && (
                        <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap">
                          {place.description}
                        </p>
                      )}
                      
                      {placePhotos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {placePhotos.map((photo, pIndex) => (
                            <div 
                              key={photo.id} 
                              className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group/photo shadow-sm"
                              onClick={() => openLightbox(place.id, pIndex)}
                            >
                              {isVideo(photo.url) ? (
                                <video src={photo.url} className="w-full h-full object-cover group-hover/photo:scale-110 transition duration-500" muted loop playsInline onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()} />
                              ) : (
                                <img loading="lazy" src={photo.thumbnail_url || photo.url} className="w-full h-full object-cover group-hover/photo:scale-110 transition duration-500" />
                              )}
                              {photo.description && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/photo:opacity-100 transition duration-300 flex items-end p-2.5">
                                  <span className="text-[10px] text-white line-clamp-3 leading-tight drop-shadow-md">{photo.description}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {normalPlaces.length === 0 && (
                <div className="text-center py-20 text-slate-400">目前尚無景點，請先在卡片模式新增</div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 新增旅程 Modal */}
      {isAddTripModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">建立新旅程</h3>
              <button onClick={() => setIsAddTripModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateTrip} className="p-5">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">旅程名稱</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="例如：2026 東京之旅" 
                  value={newTripName} 
                  onChange={e => setNewTripName(e.target.value)} 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">開始時間</label>
                  <input 
                    type="date" 
                    value={newTripStartDate} 
                    onChange={e => setNewTripStartDate(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">結束時間</label>
                  <input 
                    type="date" 
                    value={newTripEndDate} 
                    onChange={e => setNewTripEndDate(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddTripModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">建立</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 編輯旅程 Modal */}
      {isEditTripModalOpen && editTripData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">編輯旅程</h3>
              <button onClick={() => setIsEditTripModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleEditTrip} className="p-5">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">旅程名稱</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="例如：2026 東京之旅" 
                  value={editTripData.name} 
                  onChange={e => setEditTripData({ ...editTripData, name: e.target.value })} 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">開始時間</label>
                  <input 
                    type="date" 
                    value={editTripData.start_date} 
                    onChange={e => setEditTripData({ ...editTripData, start_date: e.target.value })} 
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">結束時間</label>
                  <input 
                    type="date" 
                    value={editTripData.end_date || editTripData.start_date} 
                    onChange={e => setEditTripData({ ...editTripData, end_date: e.target.value })} 
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-between gap-2">
                <button type="button" onClick={() => handleDeleteTrip(editTripData.id)} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition border border-red-100">刪除旅程</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsEditTripModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">儲存</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 幻燈片設定 Modal */}
      {isSlideshowSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">幻燈片設定</h3>
              <button onClick={() => setIsSlideshowSettingsOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">播放速度 (每張停留秒數)</label>
                <input 
                  type="number" 
                  step="0.5"
                  min="1"
                  value={slideshowConfig.speed} 
                  onChange={e => setSlideshowConfig({ ...slideshowConfig, speed: parseFloat(e.target.value) || 3.5 })} 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition text-sm" 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">完整播放影片</div>
                  <div className="text-xs text-slate-500 mt-0.5">遇到影片時暫停計時，播完再切換</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={slideshowConfig.playFullVideo} onChange={e => setSlideshowConfig({ ...slideshowConfig, playFullVideo: e.target.checked })} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">播放順序</label>
                <select
                  value={slideshowConfig.order}
                  onChange={e => setSlideshowConfig({ ...slideshowConfig, order: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition text-sm bg-white"
                >
                  <option value="random">隨機打亂 (推薦)</option>
                  <option value="chronological">依照景點順序</option>
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsSlideshowSettingsOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
                <button 
                  onClick={() => {
                    let tripPhotos = photos.filter(p => true);
                    if (slideshowConfig.order === 'random') {
                      for (let i = tripPhotos.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [tripPhotos[i], tripPhotos[j]] = [tripPhotos[j], tripPhotos[i]];
                      }
                    }
                    setSlideshowMedia(tripPhotos);
                    setCurrentSlideshowIndex(0);
                    setIsSlideshowSettingsOpen(false);
                    setIsSlideshowOpen(true);
                  }} 
                  className="px-4 py-2 text-sm font-medium bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition shadow-sm flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> 開始播放
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 隨機幻燈片短影音 Modal */}
      {isSlideshowOpen && slideshowMedia.length > 0 && (
        <div className="fixed inset-0 bg-black z-[110] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="absolute top-14 right-6 z-[999] pointer-events-auto">
            <button onClick={() => { setIsSlideshowOpen(false); setIsSlideshowMuted(false); }} className="p-3 text-white hover:text-pink-100 bg-black/40 hover:bg-black/60 rounded-full transition backdrop-blur-md border border-white/10 shadow-lg" title="關閉幻燈片">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute bottom-10 right-6 z-[999] pointer-events-auto">
            <button 
              onClick={() => {
                if (isGlobalMusicOn) setIsGlobalMusicOn(false); // 如果全域有開，幻燈片靜音就順便關掉全域
                setIsSlideshowMuted(!isSlideshowMuted);
              }} 
              className="p-3 text-white hover:text-pink-100 bg-black/40 hover:bg-black/60 rounded-full transition backdrop-blur-md border border-white/10 shadow-lg"
              title="音樂開關"
            >
              {(!isSlideshowMuted || isGlobalMusicOn) ? <Music className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          </div>
          <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
            {slideshowMedia.map((media, index) => (
              <div 
                key={media.id + '_' + index}
                className={`absolute inset-0 transition-opacity duration-1000 flex items-center justify-center ${index === currentSlideshowIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {Math.abs(index - currentSlideshowIndex) <= 1 || (index === slideshowMedia.length - 1 && currentSlideshowIndex === 0) || (index === 0 && currentSlideshowIndex === slideshowMedia.length - 1) ? (
                  isVideo(media.url) ? (
                    <video 
                      src={media.url} 
                      autoPlay 
                      playsInline 
                      muted
                      loop={!slideshowConfig.playFullVideo}
                      onEnded={() => {
                        if (slideshowConfig.playFullVideo) {
                          setCurrentSlideshowIndex((prev) => (prev + 1) % slideshowMedia.length);
                        }
                      }}
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      <img src={media.url} className="w-full h-full object-contain scale-105" />
                    </div>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* 照片描述快速編輯 Modal */}
      {isPhotoEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">編輯照片描述</h3>
              <button onClick={() => setIsPhotoEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">所屬景點</label>
                <select 
                  value={photoEditPlaceId}
                  onChange={e => setPhotoEditPlaceId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-white"
                >
                  {places.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">照片描述</label>
                <textarea 
                  autoFocus
                  placeholder="輸入關於這張照片的回憶..." 
                  value={photoEditDesc} 
                  onChange={e => setPhotoEditDesc(e.target.value)} 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm min-h-[100px] resize-none" 
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsPhotoEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
                <button type="button" onClick={() => {
                  handleSavePhotoDesc(editingPhoto, photoEditDesc, photoEditPlaceId);
                  setIsPhotoEditModalOpen(false);
                }} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm">儲存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新增/編輯景點 Modal */}
      {isPlaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 py-8 md:p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white z-10">
              <h3 className="font-bold text-lg">{editingPlace ? '編輯景點與遊記' : '新增景點與遊記'}</h3>
              <button onClick={() => setIsPlaceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* 地圖選取區 */}
              <div className="flex-none md:flex-1 h-[35vh] md:h-full bg-slate-100 relative">
                {isLoaded ? (
                  <GoogleMapComponent 
                    selectionMode={true}
                    defaultLat={placeFormData.lat} 
                    defaultLng={placeFormData.lng} 
                    onLocationSelect={(lat: any, lng: any) => setPlaceFormData(prev => ({ ...prev, lat, lng }))} 
                  />
                ) : (
                  <div className="flex-1 bg-slate-100 flex items-center justify-center text-slate-400">Google 地圖載入中...</div>
                )}
              </div>
              
              {/* 表單區 */}
              <div className="flex-1 min-h-0 w-full md:w-80 p-5 bg-white border-l border-slate-100 flex flex-col overflow-y-auto">
                <form onSubmit={handleSavePlace} className="flex flex-col gap-4 min-h-min">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">景點名稱</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        required
                        placeholder="例如：Taipei 101" 
                        value={placeFormData.name} 
                        onChange={e => setPlaceFormData(prev => ({ ...prev, name: e.target.value }))} 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm" 
                      />
                      <button 
                        type="button"
                        onClick={handleSearchLocation}
                        disabled={searchingLocation || !placeFormData.name}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 shrink-0"
                        title="透過 Google Maps 搜尋座標"
                      >
                        {searchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">緯度 (Lat)</label>
                      <input 
                        type="number" step="any" required
                        value={placeFormData.lat} 
                        onChange={e => setPlaceFormData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))} 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">經度 (Lng)</label>
                      <input 
                        type="number" step="any" required
                        value={placeFormData.lng} 
                        onChange={e => setPlaceFormData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))} 
                        className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50" 
                      />
                    </div>
                  </div>

                  {/* 遊記輸入區塊 */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                      景點遊記 / 簡略紀錄
                      <span className="text-xs text-slate-400 font-normal">Optional</span>
                    </label>
                    <textarea 
                      placeholder="寫下您在這個景點的美好回憶..." 
                      value={placeFormData.description} 
                      onChange={e => setPlaceFormData(prev => ({ ...prev, description: e.target.value }))} 
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm flex-1 min-h-[120px] resize-none" 
                    />
                  </div>
                  
                  <div className="pt-4 flex flex-col gap-2 border-t border-slate-100 mt-2">
                    {editingPlace && (
                      <div className="flex gap-2 mb-2">
                        <label className="flex-1 py-2 text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          {uploading ? '上傳中...' : '加入照片'}
                          <input type="file" accept="image/*,video/*" multiple onChange={(e) => { handleMultiplePhotoUpload(e, editingPlace.id); setIsPlaceModalOpen(false); }} disabled={uploading} className="hidden" />
                        </label>
                        <button type="button" onClick={() => { handleDeletePlace(editingPlace.id); setIsPlaceModalOpen(false); }} className="flex-1 py-2 text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition flex items-center justify-center gap-1.5">
                          <Trash2 className="w-4 h-4" /> 刪除景點
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsPlaceModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
                      <button type="submit" className="flex-1 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-sm">
                        {editingPlace ? '儲存變更' : '新增景點'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 照片放大 Lightbox 包含編輯功能 */}
      {lightboxOpen && lightboxPhotos.length > 0 && (
        <div 
          ref={lightboxRef}
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center animate-in fade-in duration-200"
        >
          <div className="absolute top-0 w-full p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent">
            <div className="text-white/70 text-sm font-medium px-2">
              {currentPhotoIndex + 1} / {lightboxPhotos.length}
            </div>
            <button onClick={closeLightbox} className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition backdrop-blur-sm">
              <X className="w-6 h-6" />
            </button>
          </div>
          


          <div className="flex-1 w-full max-w-7xl flex items-center justify-center overflow-hidden relative z-10">
            {isVideo(lightboxPhotos[currentPhotoIndex].url) ? (
              <video src={lightboxPhotos[currentPhotoIndex].url} controls autoPlay playsInline className="max-w-full max-h-full object-contain" />
            ) : (
              <TransformWrapper
                onZoomStop={(ref) => setLightboxScale(ref.state.scale)}
                onPanningStop={(ref) => setLightboxScale(ref.state.scale)}
                panning={{ disabled: lightboxScale <= 1.05 }}
              >
                {({ state }: any) => (
                  <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                    <div 
                      className="w-full h-full flex items-center justify-center"
                    >
                      <img 
                        src={lightboxPhotos[currentPhotoIndex].url} 
                        alt="Fullscreen" 
                        className="max-w-full max-h-full object-contain pointer-events-auto" 
                      />
                      {/* 預載入上一張與下一張，讓切換瞬間無延遲 */}
                      <div className="hidden">
                        <img src={lightboxPhotos[(currentPhotoIndex + 1) % lightboxPhotos.length]?.url} />
                        <img src={lightboxPhotos[(currentPhotoIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length]?.url} />
                      </div>
                    </div>
                  </TransformComponent>
                )}
              </TransformWrapper>
            )}
          </div>
        </div>
      )}
      {/* 行程附件 Modal */}
      {isTripPlansModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-800">行程附件管理</h3>
              </div>
              <button onClick={() => setIsTripPlansModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-white">
              <div className="mb-6">
                <label className="flex items-center justify-center gap-2 w-full p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition cursor-pointer text-slate-500">
                  {uploadingPlan ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : <UploadCloud className="w-6 h-6" />}
                  <span className="font-medium">{uploadingPlan ? '上傳中...' : '點擊上傳附件 (PDF, Word, Excel, 圖片)'}</span>
                  <input type="file" onChange={handlePlanUpload} disabled={uploadingPlan || !selectedTrip} className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" />
                </label>
              </div>

              {tripPlans.length > 0 ? (
                <div className="space-y-3">
                  {tripPlans.map((plan: any) => (
                    <div key={plan.id || plan.url} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition">
                      <a href={plan.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 flex-1 min-w-0 group">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-700 truncate group-hover:text-blue-600 transition">{plan.appendix || '未命名附件'}</span>
                      </a>
                      <button 
                        onClick={() => handlePlanDelete(plan.id || plan.url)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-4 flex-shrink-0"
                        title="刪除附件"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>目前沒有任何附件</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
