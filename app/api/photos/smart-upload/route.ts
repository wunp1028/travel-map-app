import { NextResponse } from 'next/server';
import { supabase, r2, geminiModel } from '@/lib/clients';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import exifParser from 'exif-parser';

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const trip_id = formData.get('trip_id') as string;
    
    if (!file || !trip_id) {
      return NextResponse.json({ error: '缺少檔案或旅程 ID' }, { status: 400 });
    }

    // 取得該旅程所有景點
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', trip_id);
      
    if (placesError) throw placesError;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;

    // 1. 擷取 EXIF GPS 與時間
    let photoTime = new Date().toISOString();
    let gpsLat = null;
    let gpsLng = null;
    try {
      const parser = exifParser.create(buffer);
      const result = parser.parse();
      const timestamp = result.tags?.DateTimeOriginal;
      if (timestamp) {
        photoTime = new Date(timestamp * 1000).toISOString();
      }
      if (result.tags?.GPSLatitude && result.tags?.GPSLongitude) {
        gpsLat = result.tags.GPSLatitude;
        gpsLng = result.tags.GPSLongitude;
      }
    } catch (e) {
      console.log("無 EXIF 資訊，使用預設時間。");
    }

    // 2. 自動分配景點
    let targetPlaceId = null;
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
        const { data: newPlace, error: newPlaceError } = await supabase
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

    // 4. 上傳照片到 Cloudflare R2
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }));
    
    const photoUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileName}`;

    // 5. 簡化版 Gemini 分析
    // const base64Data = buffer.toString('base64');
    // const imagePart = { inlineData: { data: base64Data, mimeType: file.type } };
    // const prompt = `你是一個專業的旅遊分析助手。請分析這張照片，並回傳純 JSON 格式（不要包含 markdown）：{"category": "從 [美食, 景點, 購物, 住宿, 交通] 選擇最符合", "tags": ["3個繁體中文標籤"]}`;
    
    // const aiResult = await geminiModel.generateContent([prompt, imagePart]);
    let aiData = { category: '未分類', tags: [] };
    // try {
    //   const text = aiResult.response.text().replace(/```json|```/g, '').trim();
    //   aiData = JSON.parse(text);
    // } catch (e) {
    //   console.log('Gemini 解析失敗，使用預設值');
    // }

    // 6. 寫入資料庫
    const { data: dbData, error: dbError } = await supabase
      .from('photos')
      .insert([{
        place_id: targetPlaceId,
        url: photoUrl,
        category: aiData.category,
        tags: aiData.tags,
        description: '', 
        photo_time: photoTime
      }])
      .select();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, data: dbData[0], assigned: targetPlaceId !== null });

  } catch (error: any) {
    console.error("Smart Upload Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
