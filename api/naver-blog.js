// Vercel 서버리스 함수: /api/naver-blog
const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^\s*<!\[CDATA\[\vert{}\]\]>\s*$/g, '').trim() : '';
};

export default async function handler(req, res) {
  // CORS 허용 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const id = process.env.NAVER_BLOG_ID || 'sdpainrehab';

  try {
    const r = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(id)}.xml`);
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    const xml = await r.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5).map(m => ({
      title: decode(tag(m[1], 'title')),
      link: tag(m[1], 'link'),
      description: decode(tag(m[1], 'description')).replace(/<[^>]*>/g, '').trim().slice(0, 120),
      pubDate: tag(m[1], 'pubDate'),
    }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ items: [], error: 'fetch failed' });
  }
}
