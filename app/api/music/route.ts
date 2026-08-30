import { NextResponse } from 'next/server';
import { supabase } from '@/lib/clients';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('music')
      .select('*');

    if (error) {
      console.error('取得音樂清單失敗:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('取得音樂 API 錯誤:', error);
    return NextResponse.json({ success: false, error: error.message || '未知錯誤' }, { status: 500 });
  }
}
