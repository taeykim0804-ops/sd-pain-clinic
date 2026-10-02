const BLOG_ID = 'sdpainrehab';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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

async function get(url, extra) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: Object.assign({ 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, extra || {}),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function fromRss(url) {
  const xml = await get(url, { Accept: 'application/rss+xml, application/xml, text/xml, */*' });
  if (!/<item[\s>]/.test(xml)) throw new Error('RSS에 글(item)이 없음');
  return [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].slice(0, 5).map(m => ({
    title: decode(tag(m[1], 'title')),
    link: tag(m[1], 'link').replace(/^http:\/\//, 'https://'),
    description: decode(decode(tag(m[1], 'description'))).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
    pubDate: tag(m[1], 'pubDate'),
  }));
}

async function fromList() {
  const url = 'https://blog.naver.com/PostTitleListAsync.naver?blogId=' + BLOG_ID +
    '&viewdate=&currentPage=1&categoryNo=&parentCategoryNo=&countPerPage=5';
  const txt = await get(url, { Referer: 'https://blog.naver.com/' + BLOG_ID });
  const j = JSON.parse(txt.replace(/\\'/g, "'"));
  const list = j.postList || [];
  if (!list.length) throw new Error('글 목록이 비어 있음');
  return list.slice(0, 5).map(p => {
    let title = String(p.title || '');
    try { title = decodeURIComponent(title.replace(/\+/g, ' ')); } catch (e) {}
    return {
      title,
      link: 'https://blog.naver.com/' + BLOG_ID + '/' + p.logNo,
      description: '자세한 내용은 눌러서 확인해 주세요.',
      pubDate: p.addDate || '',
    };
  });
}

module.exports = async (req, res) => {
  const sources = [
    ['RSS-1', () => fromRss('https://rss.blog.naver.com/' + BLOG_ID + '.xml')],
    ['RSS-2', () => fromRss('https://blog.rss.naver.com/' + BLOG_ID + '.xml')],
    ['목록', () => fromList()],
  ];
  const errors = [];
  for (const [name, fn] of sources) {
    try {
      const items = await fn();
      if (items && items.length) {
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
        return res.status(200).json({ items, source: name });
      }
    } catch (e) {
      errors.push(name + ': ' + String((e && e.message) || e));
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).json({ items: [], errors });
};
