// 간단한 API 서버 - Discord 봇 상태 제공
import http from 'http';
import fs from 'fs';

const PORT = process.env.PORT || 3000;
const STATUS_FILE = 'discord-status.json';

// 상태 파일 읽기
function getStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('상태 읽기 실패:', error);
  }
  return { error: 'No status available' };
}

// HTTP 서버 생성
const server = http.createServer((req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // /status - 전체 상태
    if (url.pathname === '/status') {
      const status = getStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status, null, 2));
    }
    
    // /events - 최근 이벤트만
    else if (url.pathname === '/events') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const status = getStatus();
      res.writeHead(200);
      res.end(JSON.stringify({
        events: status.recentEvents?.slice(0, limit) || [],
        lastUpdate: status.lastUpdate
      }, null, 2));
    }
    
    // /info - 봇 정보만
    else if (url.pathname === '/info') {
      const status = getStatus();
      res.writeHead(200);
      res.end(JSON.stringify({
        botInfo: status.botInfo,
        lastUpdate: status.lastUpdate
      }, null, 2));
    }
    
    // /health - 헬스체크
    else if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Discord Bot Status API'
      }, null, 2));
    }
    
    // 404
    else {
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Not found',
        availableEndpoints: ['/status', '/events', '/info', '/health']
      }, null, 2));
    }
  } else {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
});

server.listen(PORT, () => {
  console.log(`📊 API 서버 시작: http://localhost:${PORT}`);
  console.log(`   - 전체 상태: /status`);
  console.log(`   - 이벤트: /events?limit=10`);
  console.log(`   - 봇 정보: /info`);
  console.log(`   - 헬스체크: /health`);
});

export default server;
