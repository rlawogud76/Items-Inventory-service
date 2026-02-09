const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/auth/discord/callback';

// 재시도 함수 (Cloudflare 오류 대응)
async function fetchWithRetry(url, options, maxRetries = 3) {
  // User-Agent 헤더 추가 (Cloudflare 우회)
  const headers = {
    ...options.headers,
    'User-Agent': 'DiscordBot (https://angelabot.com, 1.0.0)',
    'Accept': 'application/json'
  };
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { ...options, headers });
      const text = await response.text();
      
      // Cloudflare HTML 응답 감지
      if (text.includes('<!DOCTYPE html>') || text.includes('cloudflare')) {
        console.log(`⚠️ Cloudflare 응답 감지, 재시도 ${i + 1}/${maxRetries}...`);
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1))); // 더 긴 백오프
          continue;
        }
        throw new Error('Discord API가 일시적으로 차단됨 (Cloudflare). 잠시 후 다시 시도해주세요.');
      }
      
      return { response, text };
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// Discord OAuth2 URL 생성
router.get('/discord', (req, res) => {
  console.log('🔐 OAuth 설정:', {
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    has_secret: !!DISCORD_CLIENT_SECRET
  });
  
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
    console.log('🔄 토큰 교환 시도:', {
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      has_secret: !!DISCORD_CLIENT_SECRET,
      code_length: code?.length
    });
    
    const { response: tokenResponse, text: responseText } = await fetchWithRetry(
      'https://discord.com/api/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI
        })
      }
    );
    
    console.log('📥 Discord 응답:', tokenResponse.status, responseText.substring(0, 500));
    
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Discord가 JSON이 아닌 응답 반환: ${responseText.substring(0, 200)}`);
    }
    
    if (!tokenResponse.ok) {
      console.error('❌ Discord 토큰 교환 실패:', tokenResponse.status, tokenData);
      throw new Error(`토큰 교환 실패: ${tokenResponse.status} - ${JSON.stringify(tokenData)}`);
    }
    
    if (!tokenData.access_token) {
      throw new Error('토큰 교환 실패: access_token 없음');
    }
    
    // 사용자 정보 가져오기
    const { response: userResponse, text: userText } = await fetchWithRetry(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    
    if (!userResponse.ok) {
      throw new Error(`사용자 정보 조회 실패: ${userResponse.status}`);
    }
    
    const userData = JSON.parse(userText);
    
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
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    
    console.log('🔍 /me 권한 체크:', {
      userId: decoded.id,
      SERVER_OWNER_ID,
      settingsOwnerId: settings?.serverOwnerId,
      isServerOwner,
      isAdmin
    });
    
    // 역할 결정
    let role = 'member';
    if (isServerOwner) role = 'owner';
    else if (isAdmin) role = 'admin';
    
    // 허용된 기능 키
    const allowedFeatures = isServerOwner 
      ? ['*']
      : isAdmin 
        ? (settings?.adminAllowedFeatureKeys || ['*'])
        : (settings?.memberAllowedFeatureKeys || ['*']);
    
    // 유저 정보 저장/업데이트
    await db.registerUser({
      id: decoded.id,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      lastSeen: new Date()
    });
    
    res.json({
      id: decoded.id,
      username: decoded.username,
      discriminator: decoded.discriminator,
      avatar: decoded.avatar,
      isAdmin,
      isServerOwner,
      role,
      allowedFeatures
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
