import { get_data_uri } from '../config/api';
import { saveToStorage, getFromStorage } from '../config/storage';

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
};

export type NewsPage = {
  news: NewsItem[];
  hasMore: boolean;
  total: number;
};

/** First page only. Enough to render something instantly on open. */
const CACHE_KEY = 'news_first_page';

export const PAGE_SIZE_INITIAL = 10;
export const PAGE_SIZE_MORE = 5;

export async function fetchNews(offset: number, limit: number): Promise<NewsPage> {
  const url = `${get_data_uri('NEWS')}?limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`News request failed: ${res.status}`);
  const data = await res.json();
  if (!data?.success || !Array.isArray(data.news)) throw new Error('Malformed news response');

  const page: NewsPage = {
    news: data.news,
    hasMore: Boolean(data.hasMore),
    total: Number(data.total ?? data.news.length),
  };

  // Only the first page is worth caching -- it is what the next cold open shows.
  if (offset === 0 && page.news.length > 0) {
    try {
      saveToStorage(CACHE_KEY, JSON.stringify(page));
    } catch {
      // A cache write failing must never break the screen.
    }
  }
  return page;
}

export function getCachedFirstPage(): NewsPage | null {
  try {
    const raw = getFromStorage(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.news) ? parsed : null;
  } catch {
    return null;
  }
}

/** "3h ago" -- feeds carry absolute timestamps, lists read better relative. */
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}
