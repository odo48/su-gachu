import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/confidentialitate`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
