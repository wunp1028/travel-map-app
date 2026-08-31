export function getResizedUrl(url: string | null | undefined, width: number = 384) {
  if (!url) return undefined;
  if (url.includes('_next/image')) return url; // Already resized
  
  try {
    const urlObj = new URL(url);
    const baseOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || urlObj.origin;
    const correctedUrl = `${baseOrigin}${urlObj.pathname}`;
    
    // Multiply width by 2 to account for Retina (high-DPI) displays since we use standard <img> tags
    const targetWidth = width * 2;
    
    // Select the closest bucket
    let w = 384;
    if (targetWidth <= 384) w = 384;
    else if (targetWidth <= 640) w = 640;
    else if (targetWidth <= 1080) w = 1080;
    else w = 1920;

    // Cloudflare Image Resizing API
    return `${baseOrigin}/cdn-cgi/image/width=${w},quality=100,format=auto${urlObj.pathname}`;
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
