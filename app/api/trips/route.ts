import { NextResponse } from 'next/server';
import { supabase } from '@/lib/clients';

// GET: 讀取所有旅程相簿
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: 新增一個旅程相簿
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, start_date, end_date } = body;

    const { data, error } = await supabase
      .from('trips')
      .insert([{ name, start_date, end_date }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
