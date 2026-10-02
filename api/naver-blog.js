// Vercel 서버리스 함수: /api/naver-blog
// 환경변수 NAVER_BLOG_ID 에 네이버 블로그 아이디를 등록하세요.
// 네이버 공식 RSS(https://rss.blog.naver.com/{아이디}.xml)를 서버에서 읽어 JSON으로 돌려줍니다.

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim() : '';
};

export default async function handler(req, res) {
  const id = process.env.sdpainrehab;
  if (!id) return res.status(500).json({ items: [], error: 'NAVER_BLOG_ID not set' });

  try {
    const r = await fetch(`https://rss.blog.naver.com/${sdpainrehab}.xml`);
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
