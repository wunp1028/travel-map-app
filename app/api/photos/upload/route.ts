import { NextResponse } from 'next/server';
import { supabase, r2, geminiModel } from '@/lib/clients';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import exifParser from 'exif-parser';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const place_id = formData.get('place_id') as string;
    // 接收前端手動輸入的描述（如果沒有填就給空字串）
    const description = (formData.get('description') as string) || '';

    if (!file || !place_id) {
      return NextResponse.json({ error: '缺少檔案或地點 ID' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;

    // 1. 自動擷取 EXIF 拍照時間
    let photoTime = new Date().toISOString();
    try {
      const parser = exifParser.create(buffer);
      const result = parser.parse();
      const timestamp = result.tags?.DateTimeOriginal;
      if (timestamp) {
        photoTime = new Date(timestamp * 1000).toISOString();
      }
    } catch (e) {
      console.log("無 EXIF 資訊，使用預設時間。");
    }

    // 2. 上傳照片到 Cloudflare R2
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }));
    
    const photoUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileName}`;

    // 3. 呼叫 Gemini 進行「精簡版」分析（只求 category 與 tags，省下文字生成額度）
    // const base64Data = buffer.toString('base64');
    // const imagePart = {
    //   inlineData: { data: base64Data, mimeType: file.type },
    // };

    // const prompt = `
    //   你是一個專業的旅遊分析助手。請分析這張照片，並務必回傳純 JSON 格式（不要包含 markdown 語法），包含以下欄位：
    //   {
    //     "category": "從 [美食, 景點, 購物, 住宿, 交通] 選擇最符合的一項",
    //     "tags": ["3個具體的繁體中文標籤"]
    //   }
    // `;

    // const aiResult = await geminiModel.generateContent([prompt, imagePart]);
    let aiData = { category: '未分類', tags: [] };
    // try {
    //   const text = aiResult.response.text().replace(/```json|```/g, '').trim();
    //   aiData = JSON.parse(text);
    // } catch (e) {
    //   aiData = { category: '景點', tags: ['旅行'] };
    // }

    // 4. 寫入 Supabase 資料庫 (使用前端傳入的 description)
    const { data: dbData, error: dbError } = await supabase
      .from('photos')
      .insert([{
        place_id: place_id,
        url: photoUrl,
        category: aiData.category,
        tags: aiData.tags,
        description: description, // 採用前端傳來的文字
        photo_time: photoTime
      }])
      .select();

    if (dbError) throw dbError;

    return NextResponse.json({ 
      success: true, 
      data: dbData[0] 
    });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
