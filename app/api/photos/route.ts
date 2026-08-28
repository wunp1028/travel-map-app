import { NextResponse } from 'next/server';
import { supabase, r2 } from '@/lib/clients';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// GET: 依照條件篩選照片 (例如 category = '美食')
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const place_id = searchParams.get('place_id');

    let query = supabase.from('photos').select('*');
    
    // 動態加入過濾條件
    if (category) query = query.eq('category', category);
    if (place_id) query = query.eq('place_id', place_id);

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: 手動修改照片資訊 (標籤、描述)
export async function PUT(request: Request) {
  try {
    const { id, category, tags, description, place_id } = await request.json();

    const { data, error } = await supabase
      .from('photos')
      .update({ category, tags, description, place_id })
      .eq('id', id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: 刪除照片
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    // 1. 先從資料庫取得照片網址
    const { data: photoData, error: fetchError } = await supabase
      .from('photos')
      .select('url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (photoData && photoData.url) {
      // 解析出檔名
      const urlParts = photoData.url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // 2. 從 R2 刪除
      await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
      }));
    }

    // 3. 從資料庫刪除
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
