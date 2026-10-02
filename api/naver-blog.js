const BLOG_ID = 'sdpainrehab';
const URLS = [
  'https://rss.blog.naver.com/' + BLOG_ID + '.xml',
  'https://blog.rss.naver.com/' + BLOG_ID + '.xml',
];

const decode = s => s
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim() : '';
};

async function getRss() {
  let lastErr;
  for (const url of URLS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      });
      clearTimeout(t);
      if (!r.ok) throw new Error('RSS ' + r.status + ' @ ' + url);
      const xml = await r.text();
      if (!/<item[\s>]/.test(xml)) throw new Error('no <item> @ ' + url);
      return xml;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export default async function handler(req, res) {
  try {
    const xml = await getRss();
    const items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].slice(0, 5).map(m => ({
      title: decode(tag(m[1], 'title')),
      link: tag(m[1], 'link').replace(/^http:\/\//, 'https://'),
      description: decode(decode(tag(m[1], 'description'))).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
      pubDate: tag(m[1], 'pubDate'),
    }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ items: [], error: String(e.message || e) });
  }
}
