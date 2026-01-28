# Render 환경 변수 설정 가이드

## 필수 환경 변수

Render 대시보드 → 서비스 선택 → Environment 탭에서 다음 변수들을 추가하세요:

### 1. Discord OAuth
```
DISCORD_CLIENT_ID=1462804037908037860
DISCORD_CLIENT_SECRET=IGotWWZFvwXXycWSCav5Cvu_Gzdl96Nh
DISCORD_REDIRECT_URI=https://items-inventory-service.onrender.com/api/auth/discord/callback
CLIENT_URL=https://items-inventory-service.onrender.com
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 2. JWT Secret
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 3. MongoDB
```
MONGODB_URI=mongodb+srv://rlawogud76:563412@cluster0.cwipf8j.mongodb.net/minecraft-inventory
```

### 4. Client URL
```
CLIENT_URL=https://items-inventory-service.onrender.com
```

### 5. Node Environment
```
NODE_ENV=production
```

### 6. Port (자동 설정되지만 명시 가능)
```
PORT=3001
```

## Discord Developer Portal 설정

1. https://discord.com/developers/applications 접속
2. 애플리케이션 선택 (ID: 1462804037908037860)
3. **OAuth2** → **Redirects** 메뉴
4. 다음 URL 추가:
   ```
   https://items-inventory-service.onrender.com/api/auth/discord/callback
   ```
5. **Save Changes** 클릭

## 주의사항

- 모든 URL에서 `//` (이중 슬래시) 사용 금지
- 환경 변수 추가 후 **Manual Deploy** 또는 자동 재배포 대기
- Discord Redirect URI는 정확히 일치해야 함 (끝에 `/` 없음)

## 테스트

환경 변수 설정 후:
1. https://items-inventory-service.onrender.com 접속
2. 로그인 버튼 클릭
3. Discord 로그인 페이지로 리다이렉트 확인
4. 로그인 후 대시보드로 돌아오는지 확인
