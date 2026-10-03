const BLOG_ID = 'sdpainrehab';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const RSS_URL = 'https://rss.blog.naver.com/' + BLOG_ID + '.xml';

const decode = s => String(s || '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, '&');

const clean = (s, n) => decode(decode(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const unurl = s => {
  s = String(s || '');
  if (!/%[0-9A-Fa-f]{2}/.test(s)) return s;
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; }
};

const tag = (xml, name) => {
  const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim() : '';
};

async function get(url, extra, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: Object.assign({ 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' }, extra || {}),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('시간 초과');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function check(items) {
  const ok = (items || []).filter(i => i.title && /^https?:\/\//.test(i.link));
  if (!ok.length) throw new Error('쓸 수 있는 글이 없음');
  return ok.slice(0, 5);
}

function parseRss(xml) {
  if (!/<item[\s>]/.test(xml)) throw new Error('RSS에 글(item)이 없음');
  return check([...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].map(m => ({
    title: decode(tag(m[1], 'title')),
    link: tag(m[1], 'link').replace(/^http:\/\//, 'https://'),
    description: clean(tag(m[1], 'description'), 120),
    pubDate: tag(m[1], 'pubDate'),
  })));
}

/* ---------- 1단계: 네이버에 직접 요청 ---------- */
const direct = [
  ['RSS-1', async () => parseRss(await get(RSS_URL, { Accept: 'application/rss+xml, application/xml, text/xml, */*' }, 3500))],
  ['RSS-2', async () => parseRss(await get('https://blog.rss.naver.com/' + BLOG_ID + '.xml', { Accept: 'application/xml, */*' }, 3500))],
  ['모바일목록', async () => {
    const txt = await get(
      'https://m.blog.naver.com/api/blogs/' + BLOG_ID + '/post-list?categoryNo=0&itemCount=5&page=1',
      { Referer: 'https://m.blog.naver.com/' + BLOG_ID, Accept: 'application/json' }, 3500);
    const j = JSON.parse(txt);
    const list = (j.result && j.result.postList) || [];
    return check(list.map(p => ({
      title: clean(unurl(p.titleWithInspectedComplete || p.title), 100),
      link: 'https://blog.naver.com/' + BLOG_ID + '/' + p.logNo,
      description: clean(p.briefContents, 120) || '자세한 내용은 눌러서 확인해 주세요.',
      pubDate: p.addDate ? new Date(Number(p.addDate)).toUTCString() : '',
    })));
  }],
  ['PC목록', async () => {
    const txt = await get(
      'https://blog.naver.com/PostTitleListAsync.naver?blogId=' + BLOG_ID + '&viewdate=&currentPage=1&categoryNo=&parentCategoryNo=&countPerPage=5',
      { Referer: 'https://blog.naver.com/' + BLOG_ID }, 3500);
    const j = JSON.parse(txt.replace(/\\'/g, "'"));
    return check((j.postList || []).map(p => ({
      title: clean(unurl(p.title), 100),
      link: 'https://blog.naver.com/' + BLOG_ID + '/' + p.logNo,
      description: '자세한 내용은 눌러서 확인해 주세요.',
      pubDate: p.addDate || '',
    })));
  }],
];

/* ---------- 2단계: 중간 전달 서비스 이용 ---------- */
const proxies = [
  ['rss2json', async () => {
    const j = JSON.parse(await get('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(RSS_URL), {}, 4500));
    if (j.status !== 'ok') throw new Error('status=' + j.status + ' ' + (j.message || ''));
    return check((j.items || []).map(i => ({
      title: decode(i.title),
      link: String(i.link || '').replace(/^http:\/\//, 'https://'),
      description: clean(i.description || i.content, 120),
      pubDate: i.pubDate || '',
    })));
  }],
  ['allorigins', async () => parseRss(await get('https://api.allorigins.win/raw?url=' + encodeURIComponent(RSS_URL), {}, 4500))],
  ['corsproxy', async () => parseRss(await get('https://corsproxy.io/?' + encodeURIComponent(RSS_URL), {}, 4500))],
];

function first(tasks) {
  return Promise.any(tasks.map(([name, fn]) =>
    fn().then(items => ({ items, name })).catch(e => { throw new Error(name + ': ' + String((e && e.message) || e)); })
  ));
}

module.exports = async (req, res) => {
  const errors = [];
  for (const stage of [direct, proxies]) {
    try {
      const { items, name } = await first(stage);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
      return res.status(200).json({ items, source: name });
    } catch (e) {
      (e.errors || [e]).forEach(x => errors.push(String((x && x.message) || x)));
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).json({ items: [], errors });
};
