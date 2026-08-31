import { NextResponse } from 'next/server';
import { adminSupabase, r2 } from '@/lib/clients';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// GET: 讀取特定旅程的所有景點
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trip_id = searchParams.get('trip_id');

    if (!trip_id) return NextResponse.json({ error: '缺少 trip_id' }, { status: 400 });

    const { data, error } = await adminSupabase
      .from('places')
      .select('*')
      .eq('trip_id', trip_id)
      .order('order_index', { ascending: true }); // 依照排序欄位輸出

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: 新增一個打卡景點
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id, name, lat, lng, order_index, description } = body;

    const { data, error } = await adminSupabase
      .from('places')
      .insert([{ trip_id, name, lat, lng, order_index, description }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: 修改景點資訊
export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, lat, lng, order_index, description } = body;

    const { data, error } = await adminSupabase
      .from('places')
      .update({ name, lat, lng, order_index, description })
      .eq('id', id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: 刪除景點
export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    // 1. 先取得要刪除的景點底下的所有照片
    const { data: photos, error: fetchPhotosError } = await adminSupabase
      .from('photos')
      .select('id, url, thumbnail_url')
      .eq('place_id', id);

    if (fetchPhotosError) throw fetchPhotosError;

    // 2. 刪除 R2 上的實體檔案 (原圖與縮圖)
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        // 刪除原圖
        if (photo.url) {
          const fileName = photo.url.split('/').pop();
          if (fileName) {
            await r2.send(new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: fileName,
            }));
          }
        }
        // 刪除縮圖
        if (photo.thumbnail_url) {
          const thumbFileName = photo.thumbnail_url.split('/').pop();
          if (thumbFileName) {
            await r2.send(new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: thumbFileName,
            }));
          }
        }
      }

      // 3. 刪除 Supabase 中的照片紀錄
      const { error: deletePhotosError } = await adminSupabase
        .from('photos')
        .delete()
        .eq('place_id', id);
        
      if (deletePhotosError) throw deletePhotosError;
    }

    // 4. 最後刪除景點
    const { error } = await adminSupabase
      .from('places')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
