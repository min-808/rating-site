const crypto = require('crypto');
const { put, list } = require('@vercel/blob');

// one year: the file at a given key never changes, so it can cache forever
const CACHE_SECONDS = 60 * 60 * 24 * 365;

const EXT_BY_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function keyFor(prefix, url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i) || [, 'png'])[1].toLowerCase();
  return `${prefix}/${hash}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

async function loadExistingBlobs(prefix) {
  const existing = new Map();
  let cursor;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) existing.set(blob.pathname, blob.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return existing;
}

function createBlobMirror({ httpClient, headers, prefixes = ['pfp', 'dan'] }) {
  let existing = null;
  const inFlight = new Map();
  const stats = { reused: 0, uploaded: 0, failed: 0 };

  async function ready() {
    if (existing) return;
    existing = new Map();
    for (const prefix of prefixes) {
      const found = await loadExistingBlobs(`${prefix}/`);
      for (const [pathname, url] of found) existing.set(pathname, url);
    }
    console.log(`Blob store: ${existing.size} image(s) already saved.`);
  }

  async function mirror(prefix, sourceUrl) {
    if (!sourceUrl) return null;
    await ready();

    const key = keyFor(prefix, sourceUrl);

    const cached = existing.get(key);
    if (cached) {
      stats.reused++;
      return cached;
    }

    if (inFlight.has(key)) return inFlight.get(key);

    const task = (async () => {
      try {
        const response = await httpClient.get(sourceUrl, {
          headers,
          responseType: 'arraybuffer',
          timeout: 15000,
        });

        const contentType = (response.headers['content-type'] || '').split(';')[0].trim();
        if (!contentType.startsWith('image/')) {
          throw new Error(`not an image (got ${contentType || 'no content-type'})`);
        }

        const body = Buffer.from(response.data);
        if (body.length === 0) throw new Error('empty response');

        const ext = EXT_BY_TYPE[contentType];
        const finalKey = ext && !key.endsWith(ext) ? key.replace(/\.[^.]+$/, ext) : key;

        const blob = await put(finalKey, body, {
          access: 'public',
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: CACHE_SECONDS,
        });

        existing.set(finalKey, blob.url);
        stats.uploaded++;
        return blob.url;
      } catch (error) {
        stats.failed++;
        console.warn(`  ! could not mirror ${sourceUrl}: ${error.message}`);
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, task);
    return task;
  }

  return { mirror, stats };
}

module.exports = { createBlobMirror };