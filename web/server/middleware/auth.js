const jwt = require('jsonwebtoken');
const db = require('shared/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    decoded.adminAllowedFeatures = settings?.adminAllowedFeatureKeys || ['*'];
    decoded.memberAllowedFeatures = settings?.memberAllowedFeatureKeys || ['*'];
    
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
      req.user = decoded;
    } catch (error) {
      // 토큰이 유효하지 않아도 계속 진행
    }
  }
  
  next();
}

// 관리자 전용
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

// 기능별 권한 확인
function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    const allowedFeatures = req.user.isAdmin 
      ? req.user.adminAllowedFeatures 
      : req.user.memberAllowedFeatures;
    
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
  requireFeature
};
