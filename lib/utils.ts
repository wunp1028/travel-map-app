export function getResizedUrl(url: string | null | undefined, width: number = 300) {
  if (!url) return undefined;
  if (url.includes('cdn-cgi/image')) return url; // Already resized
  
  try {
    const urlObj = new URL(url);
    const baseOrigin = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || urlObj.origin;
    // Cloudflare Edge Resizing URL format
    return `${baseOrigin}/cdn-cgi/image/width=${width},quality=100,format=auto,fit=cover${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}
