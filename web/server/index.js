require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Shared modules
const db = require('shared/database');

// Routes
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const recipeRoutes = require('./routes/recipes');
const tagRoutes = require('./routes/tags');
const contributionRoutes = require('./routes/contributions');
const historyRoutes = require('./routes/history');
const settingRoutes = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// 허용할 Origin 목록 (외부 접속 지원)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://192.168.219.175:5173',
  'https://angelabot.com',
  'https://www.angelabot.com',
  'https://gu5v87dg.up.railway.app',
  process.env.CLIENT_URL
].filter(Boolean);

// Socket.io 설정
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // origin이 없으면 (같은 서버) 허용
      if (!origin) return callback(null, true);
      
      // 허용 목록에 있거나 192.168.x.x 대역이면 허용
      if (allowedOrigins.includes(origin) || /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
        return callback(null, true);
      }
      callback(null, true); // 일단 모두 허용 (개발용)
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, true); // 일단 모두 허용 (개발용)
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 프로덕션: 빌드된 프론트엔드 제공
const clientDist = path.join(__dirname, '../client/dist');
console.log('📁 Static files path:', clientDist);

// Static 파일 존재 확인
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  console.log('✅ dist 폴더 존재');
  app.use(express.static(clientDist));
  
  // SPA fallback - API가 아닌 모든 요청을 index.html로
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  console.log('⚠️ dist 폴더 없음 - API only mode');
}

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('🔌 클라이언트 연결:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 클라이언트 연결 해제:', socket.id);
  });
});

// 데이터베이스 변경 시 소켓으로 브로드캐스트
db.addChangeListener((event) => {
  io.emit('data-changed', { type: event.operationType, timestamp: Date.now() });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('❌ 서버 에러:', err);
  res.status(err.status || 500).json({
    error: err.message || '서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 서버 시작
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    const connected = await db.connectDatabase();
    
    // MongoDB 연결 성공 시에만 변경 감지 시작
    if (connected) {
      db.watchInventoryChanges();
    } else {
      console.warn('⚠️ MongoDB 연결 실패 - 변경 감지 비활성화');
    }
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API 서버 실행 중: http://0.0.0.0:${PORT}`);
      console.log(`🌐 외부 접속: http://192.168.219.175:${PORT}`);
      if (!connected) {
        console.log('⚠️ MongoDB가 연결되지 않았습니다. 로컬 MongoDB를 시작하거나 .env에 MONGODB_URI를 설정하세요.');
      }
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  await db.disconnectDatabase();
  process.exit(0);
});

module.exports = { app, server, io };
