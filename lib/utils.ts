export function getResizedUrl(url: string | null | undefined, width: number = 300) {
  if (!url) return undefined;
  if (url.includes('cdn-cgi/image')) return url; // Already resized
  
  try {
    const urlObj = new URL(url);
    // Cloudflare Edge Resizing URL format
    return `${urlObj.origin}/cdn-cgi/image/width=${width},quality=100,format=auto,fit=cover${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}
