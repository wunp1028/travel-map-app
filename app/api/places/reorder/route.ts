import { NextResponse } from 'next/server';
import { supabase } from '@/lib/clients';

// PUT: 批次更新景點順序
export async function PUT(request: Request) {
  try {
    // 預期前端傳來: [{ id: '1', order_index: 1 }, { id: '2', order_index: 2 }]
    const updates = await request.json(); 
    
    // Supabase 支援 upsert 進行批次更新
    const { data, error } = await supabase
      .from('places')
      .upsert(updates)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, message: '排序已更新' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
