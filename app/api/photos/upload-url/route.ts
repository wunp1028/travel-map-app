import { NextResponse } from 'next/server';
import { r2 } from '@/lib/clients';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType');
    const extension = searchParams.get('extension') || 'jpg';

    if (!contentType) {
      return NextResponse.json({ error: 'Missing contentType' }, { status: 400 });
    }

    const fileName = `${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    });

    // 產生一組 5 分鐘內有效的上傳 URL
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileName}`;

    return NextResponse.json({ success: true, uploadUrl, publicUrl, fileName });
  } catch (error: any) {
    console.error("Presigned URL Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
