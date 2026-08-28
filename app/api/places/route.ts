import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/clients';

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
