export default async function handler(req, res) {
    const rssUrl = 'https://rss.blog.naver.com/sdpainrehab.xml';
    
    try {
        // User-Agent를 브라우저 값으로 설정하여 네이버의 서버 차단 우회
        const response = await fetch(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`네이버 응답 오류: ${response.status}`);
        }

        const xmlText = await response.text();
        
        // 브라우저로 XML 데이터 반환
        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.status(200).send(xmlText);
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: '블로그 연동 실패' });
    }
}
