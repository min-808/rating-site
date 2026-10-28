import type { MetadataRoute } from 'next';

/**
 * Tells well-behaved crawlers to stay out of the parts that aren't pages worth indexing.
 * Every profile and song page a crawler opens can cost a database read, so keeping them
 * out of /api and the account pages saves some. (Crawlers that ignore this need a rate
 * limit in Vercel's firewall instead.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/settings', '/login', '/loginhelp'] }],
  };
}
