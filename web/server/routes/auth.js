const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/auth/discord/callback';

// Discord OAuth2 URL 생성
router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Discord OAuth2 콜백
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=no_code`);
  }
  
  try {
    // 토큰 교환
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('토큰 교환 실패');
    }
    
    // 사용자 정보 가져오기
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const userData = await userResponse.json();
    
    // JWT 생성
    const token = jwt.sign(
      {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // 쿠키에 토큰 저장 후 클라이언트로 리다이렉트
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
    });
    
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback`);
  } catch (error) {
    console.error('Discord OAuth 에러:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
  }
});

// 현재 사용자 정보
router.get('/me', async (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: '인증되지 않음' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 관리자/서버장 여부 확인
    const db = require('shared/database');
    const settings = await db.getSettings();
    const isAdmin = settings?.adminUserIds?.includes(decoded.id) || false;
    const SERVER_OWNER_ID = process.env.SERVER_OWNER_ID;
    const isServerOwner = decoded.id === SERVER_OWNER_ID || decoded.id === settings?.serverOwnerId;
    
    res.json({
      id: decoded.id,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      isAdmin,
      isServerOwner
    });
  } catch (error) {
    res.status(401).json({ error: '유효하지 않은 토큰' });
  }
});

// 로그아웃
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// 개발용: 토큰 없이 테스트 로그인
router.post('/dev-login', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: '프로덕션에서는 사용 불가' });
  }
  
  const { username = 'TestUser', id = '123456789' } = req.body;
  
  const token = jwt.sign(
    { id, username, discriminator: '0000', avatar: null },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  res.json({ success: true, username });
});

module.exports = router;
