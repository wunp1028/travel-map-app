import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/clients';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('trip_id');

    if (!tripId) {
      return NextResponse.json({ error: 'Missing trip_id' }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from('trip_plan')
      .select('*')
      .eq('trip_id', tripId)
      .order('id', { ascending: false });

    // Fallback if 'id' doesn't exist for ordering
    if (error && error.message.includes('id')) {
      const { data: dataNoOrder, error: errNoOrder } = await adminSupabase
        .from('trip_plan')
        .select('*')
        .eq('trip_id', tripId);
      
      if (errNoOrder) throw errNoOrder;
      return NextResponse.json({ success: true, data: dataNoOrder });
    }

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id, appendix, url } = body;

    if (!trip_id || !appendix || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from('trip_plan')
      .insert([{ trip_id, appendix, url }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const url = searchParams.get('url');

    if (!id && !url) {
      return NextResponse.json({ error: 'Missing id or url' }, { status: 400 });
    }

    let query = adminSupabase.from('trip_plan').delete();
    
    if (id) {
      query = query.eq('id', id);
    } else if (url) {
      query = query.eq('url', url);
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
