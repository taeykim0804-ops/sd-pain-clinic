export default async function handler(req, res) {
    const rssUrl = 'https://rss.blog.naver.com/sdpainrehab.xml';
    
    try {
        const response = await fetch(rssUrl);
        const xmlText = await response.text();
        
        // 가져온 네이버 블로그 XML 데이터를 프론트엔드로 그대로 전달
        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.status(200).send(xmlText);
    } catch (error) {
        res.status(500).json({ error: '블로그 연동 실패' });
    }
}
