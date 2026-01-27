# 재고 관리 시스템 - 웹 버전

Discord 봇과 동일한 MongoDB를 공유하는 React 웹 대시보드입니다.

## 프로젝트 구조

```
재고처리/
├── bot/                    # Discord 봇 (기존 코드)
├── shared/                 # 공유 모듈 (DB, 모델, 서비스)
│   ├── database.js
│   ├── constants.js
│   ├── models/
│   └── services/
├── web/
│   ├── server/             # Express API 서버
│   │   ├── index.js
│   │   ├── routes/
│   │   └── middleware/
│   └── client/             # React 프론트엔드
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── contexts/
│       │   └── services/
│       └── package.json
└── package.json            # 워크스페이스 루트
```

## 시작하기

### 1. 의존성 설치

```bash
# 루트에서 모든 워크스페이스 의존성 설치
npm install
```

### 2. 환경 변수 설정

```bash
# web/server/.env 파일 생성
cp web/server/.env.example web/server/.env

# 필요한 값 수정
# - MONGODB_URI: MongoDB 연결 문자열
# - JWT_SECRET: JWT 시크릿 키
# - DISCORD_CLIENT_ID: Discord OAuth2 클라이언트 ID (선택)
# - DISCORD_CLIENT_SECRET: Discord OAuth2 시크릿 (선택)
```

### 3. 개발 서버 실행

```bash
# API 서버 + React 개발 서버 동시 실행
npm run dev

# 또는 개별 실행
npm run server    # API 서버 (localhost:3001)
npm run client    # React 앱 (localhost:5173)
```

### 4. Discord 봇 실행 (선택)

```bash
npm run bot
```

## 기능

### 웹 대시보드
- **대시보드**: 전체 재고/제작 현황 요약
- **재고 관리**: 카테고리별 아이템 조회, 수량 변경
- **제작 관리**: 제작품 조회, 레시피 확인
- **기여도**: 사용자별 기여도 순위
- **수정 내역**: 최근 변경 히스토리
- **설정**: UI 설정 관리

### 실시간 동기화
- Socket.io를 통한 실시간 데이터 동기화
- 봇에서 수정해도 웹에 즉시 반영
- 웹에서 수정해도 봇에 즉시 반영

### 인증
- Discord OAuth2 로그인
- 개발용 테스트 로그인
- 로그인 없이 조회 가능

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/auth/discord` | GET | Discord OAuth2 로그인 |
| `/api/auth/me` | GET | 현재 사용자 정보 |
| `/api/items/:type` | GET | 아이템 목록 조회 |
| `/api/items/:type/:category/:name/quantity` | PATCH | 수량 변경 |
| `/api/recipes` | GET | 레시피 목록 |
| `/api/contributions` | GET | 기여도 조회 |
| `/api/history` | GET | 수정 내역 |
| `/api/settings` | GET/PATCH | 설정 조회/수정 |
| `/api/tags/:type/:category` | GET | 태그 목록 |

## 배포

### Vercel (프론트엔드)
```bash
cd web/client
vercel
```

### Railway (백엔드)
1. Railway 프로젝트 생성
2. GitHub 연결
3. 환경 변수 설정
4. `web/server` 폴더를 루트로 설정

## 기술 스택

### 백엔드
- Express.js
- Socket.io
- MongoDB + Mongoose
- JWT 인증

### 프론트엔드
- React 18
- Vite
- Tailwind CSS
- React Query
- React Router
