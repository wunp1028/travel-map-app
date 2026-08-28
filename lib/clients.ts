import { createClient } from '@supabase/supabase-js';
import { S3Client } from '@aws-sdk/client-s3';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. 初始化 Supabase
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 2. 初始化 Cloudflare R2 (使用 AWS S3 套件)
export const r2 = new S3Client({
  region: 'auto', // R2 固定填 auto
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// 3. 初始化 Google Gemini 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
// 使用 1.5-flash 模型，速度極快且支援視覺辨識
export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
