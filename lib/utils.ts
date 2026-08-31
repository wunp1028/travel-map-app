export function getResizedUrl(url: string | null | undefined, width: number = 384) {
  if (!url) return undefined;
  if (url.includes('_next/image')) return url; // Already resized
  
  try {
    const urlObj = new URL(url);
    const baseOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || urlObj.origin;
    const correctedUrl = `${baseOrigin}${urlObj.pathname}`;
    
    // Vercel/Next.js default allowed image sizes: 16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080...
    let w = 384;
    if (width <= 96) w = 96;
    else if (width <= 256) w = 256;
    else if (width <= 384) w = 384;
    else if (width <= 640) w = 640;
    else w = 1080;

    // Use Next.js built-in Image Optimization API
    return `/_next/image?url=${encodeURIComponent(correctedUrl)}&w=${w}&q=75`;
  } catch (e) {
    return url;
  }
}

export function getOriginalUrl(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const urlObj = new URL(url);
    const baseOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || urlObj.origin;
    return `${baseOrigin}${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}
