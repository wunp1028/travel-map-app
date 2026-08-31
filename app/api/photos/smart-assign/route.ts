import { NextResponse } from 'next/server';
import { adminSupabase, geminiModel } from '@/lib/clients';

// 計算兩點經緯度距離 (公里)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id, photoUrl, thumbnailUrl, gpsLat, gpsLng, photoTime, override_place_id } = body;
    
    if (!trip_id || !photoUrl) {
      return NextResponse.json({ error: 'Missing trip_id or photoUrl' }, { status: 400 });
    }

    let targetPlaceId = override_place_id;

    if (!targetPlaceId) {
      // 取得該旅程所有景點
      const { data: places, error: placesError } = await adminSupabase
        .from('places')
        .select('*')
        .eq('trip_id', trip_id);
        
      if (placesError) throw placesError;

      // 2. 自動分配景點
      if (gpsLat && gpsLng && places && places.length > 0) {
        let minDistance = Infinity;
        let nearestPlace = null;
        for (const place of places) {
          if (place.lat && place.lng && place.name !== '未分配照片區') {
            const dist = getDistanceFromLatLonInKm(gpsLat, gpsLng, place.lat, place.lng);
            if (dist < minDistance) {
              minDistance = dist;
              nearestPlace = place;
            }
          }
        }
        // 假設距離在 10 公里內則自動分配
        if (nearestPlace && minDistance < 10) {
          targetPlaceId = nearestPlace.id;
        }
      }

      // 3. 如果無法分配，尋找或建立「未分配照片區」
      if (!targetPlaceId) {
        let unassignedPlace = (places || []).find(p => p.name === '未分配照片區');
        if (!unassignedPlace) {
          const { data: newPlace, error: newPlaceError } = await adminSupabase
            .from('places')
            .insert([{ 
              trip_id, 
              name: '未分配照片區', 
              lat: 0, 
              lng: 0, 
              order_index: 999 
            }])
            .select();
          if (newPlaceError) throw newPlaceError;
          targetPlaceId = newPlace[0].id;
        } else {
          targetPlaceId = unassignedPlace.id;
        }
      }
    }

    // (選擇性) Gemini 分析，目前預設不開啟
    let aiData = { category: '未分類', tags: [] };

    // 6. 寫入資料庫
    const { data: dbData, error: dbError } = await adminSupabase
      .from('photos')
      .insert([{
        place_id: targetPlaceId,
        url: photoUrl,
        category: aiData.category,
        tags: aiData.tags,
        description: '', 
        photo_time: photoTime || new Date().toISOString()
      }])
      .select();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, data: dbData[0], assigned: targetPlaceId !== null });

  } catch (error: any) {
    console.error("Smart Assign Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
