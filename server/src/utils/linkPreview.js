import ogs from "open-graph-scraper";
// Private/internal IP regex for SSRF Protection (Tier-1 standard)
const PRIVATE_IP_REGEX = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/i;
// In-Memory LRU Cache with TTL (24 Hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const linkPreviewCache = new Map(); // cleanUrl -> { data, expiresAt }
/**
 * Normalizes URL and removes trailing punctuation (e.g. "https://react.dev." -> "https://react.dev")
 */
export const normalizeUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
    }
    return url.replace(/[.,!?;:)]+$/, "");
};
/**
 * Extracts OpenGraph metadata with in-memory caching and SSRF guards.
 * Returns null if not found or invalid — never throws an error.
 */
export const extractLinkPreview = async (rawUrl) => {
    const cleanUrl = normalizeUrl(rawUrl);
    if (!cleanUrl) return null;
    // 1. Check In-Memory Cache (0.05ms on Cache Hit!)
    const cached = linkPreviewCache.get(cleanUrl);
    if (cached) {
        if (Date.now() < cached.expiresAt) {
            return cached.data;
        }
        linkPreviewCache.delete(cleanUrl); // Expired entry
    }
    try {
        const parsed = new URL(cleanUrl);
        // 2. SSRF Protection: Block internal localhost / loopback / cloud metadata IPs
        if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
            return null;
        }
        // 3. Fast Scraping with hard 2.5-second timeout
        const options = {
            url: cleanUrl,
            timeout: 2500,
            headers: {
                "user-agent": "Mozilla/5.0 (compatible; TxtroBot/1.0; +https://txtro.app)"
            }
        };
        const { result } = await ogs(options);
        if (!result || !result.success) return null;
        // Waterfall fallbacks for title, description, and image
        const title = result.ogTitle || result.twitterTitle || result.dcTitle || null;
        const description = result.ogDescription || result.twitterDescription || result.dcDescription || null;
        let image = null;
        if (Array.isArray(result.ogImage) && result.ogImage.length > 0) {
            image = result.ogImage[0]?.url || null;
        } else if (typeof result.ogImage === "object") {
            image = result.ogImage?.url || null;
        } else if (Array.isArray(result.twitterImage) && result.twitterImage.length > 0) {
            image = result.twitterImage[0]?.url || null;
        }
        const siteName = result.ogSiteName || parsed.hostname.replace(/^www\./i, "");
        // Only create a preview if at least a title or image was extracted
        if (!title && !image) return null;
        const previewData = {
            url: cleanUrl,
            title: title ? title.slice(0, 200) : null,
            description: description ? description.slice(0, 300) : null,
            image,
            siteName
        };
        // 4. Save to Cache (Evict oldest if size exceeds limit)
        if (linkPreviewCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = linkPreviewCache.keys().next().value;
            linkPreviewCache.delete(oldestKey);
        }
        linkPreviewCache.set(cleanUrl, {
            data: previewData,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
        return previewData;
    } catch {
        return null;
    }
};