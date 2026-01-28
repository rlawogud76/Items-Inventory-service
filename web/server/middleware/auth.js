const jwt = require('jsonwebtoken');
const db = require('shared/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SERVER_OWNER_ID = process.env.SERVER_OWNER_ID; // 서버장 Discord ID

console.log('🔐 SERVER_OWNER_ID 환경변수:', SERVER_OWNER_ID || '(설정되지 않음)');

// 인증 미들웨어
async function authenticate(req, res, next) {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 관리자 여부 확인
    const settings = await db.getSettings();
    decoded.isAdmin = settings?.adminUserIds?.includes(decoded.id) || false;
    decoded.isServerOwner = decoded.id === SERVER_OWNER_ID || decoded.id === settings?.serverOwnerId;
    decoded.adminAllowedFeatures = settings?.adminAllowedFeatureKeys || ['*'];
    decoded.memberAllowedFeatures = settings?.memberAllowedFeatureKeys || ['*'];
    
    console.log('🔍 인증 체크:', {
      userId: decoded.id,
      SERVER_OWNER_ID,
      settingsOwnerId: settings?.serverOwnerId,
      isServerOwner: decoded.isServerOwner
    });
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

// 선택적 인증 (로그인 안해도 됨)
async function optionalAuth(req, res, next) {
  const token = req.cookies.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const settings = await db.getSettings();
      decoded.isAdmin = settings?.adminUserIds?.includes(decoded.id) || false;
      decoded.isServerOwner = decoded.id === SERVER_OWNER_ID || decoded.id === settings?.serverOwnerId;
      decoded.adminAllowedFeatures = settings?.adminAllowedFeatureKeys || ['*'];
      decoded.memberAllowedFeatures = settings?.memberAllowedFeatureKeys || ['*'];
      req.user = decoded;
    } catch (error) {
      // 토큰이 유효하지 않아도 계속 진행
    }
  }
  
  next();
}

// 관리자 전용
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin && !req.user?.isServerOwner) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

// 서버장 전용
function requireServerOwner(req, res, next) {
  if (!req.user?.isServerOwner) {
    return res.status(403).json({ error: '서버장만 접근할 수 있습니다.' });
  }
  next();
}

// 기능별 권한 확인
function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    // 서버장은 모든 권한 허용
    if (req.user.isServerOwner) {
      return next();
    }
    
    const allowedFeatures = req.user.isAdmin 
      ? (req.user.adminAllowedFeatures || ['*'])
      : (req.user.memberAllowedFeatures || []);
    
    // '*' 포함 시 모든 기능 허용
    if (allowedFeatures.includes('*') || allowedFeatures.includes(featureKey)) {
      return next();
    }
    
    return res.status(403).json({ error: `'${featureKey}' 기능에 대한 권한이 없습니다.` });
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  requireServerOwner,
  requireFeature
};
