# MongoDB 데이터 구조 마이그레이션 가이드

## 개요

기존의 단일 document 구조에서 정규화된 컬렉션 구조로 마이그레이션합니다.

### 기존 구조 (Before)
```
inventories (컬렉션)
└── single document
    ├── categories (Mixed)
    ├── crafting (Mixed)
    ├── tags (Mixed)
    ├── settings (Object)
    └── history (Array)
```

### 새 구조 (After)
```
inventoryitems (컬렉션) - 재고/제작 아이템
├── type: 'inventory' | 'crafting'
├── category: String
├── name: String
├── quantity: Number
├── required: Number
└── emoji: String

recipes (컬렉션) - 레시피
├── type: 'crafting'
├── category: String
├── itemName: String
└── materials: Array

tags (컬렉션) - 태그
├── type: 'inventory' | 'crafting'
├── category: String
├── tagName: String
└── items: Array

histories (컬렉션) - 히스토리
├── timestamp: String
├── type: 'inventory' | 'crafting'
├── category: String
├── itemName: String
├── action: String
├── details: String
└── userName: String

settings (컬렉션) - 설정 (싱글톤)
├── uiMode: 'normal' | 'detailed'
└── barLength: Number
```

## 장점

### 1. 성능 향상
- **선택적 조회**: 특정 카테고리나 아이템만 조회 가능
- **인덱싱**: 자주 조회되는 필드에 인덱스 적용
- **부분 업데이트**: 전체 document가 아닌 특정 아이템만 업데이트

### 2. 확장성
- **데이터 증가**: 아이템이 많아져도 성능 저하 최소화
- **쿼리 최적화**: 복잡한 쿼리 작성 가능
- **통계 분석**: 집계 쿼리로 통계 생성 용이

### 3. 유지보수성
- **명확한 스키마**: 타입 안정성 확보
- **데이터 무결성**: 스키마 검증으로 잘못된 데이터 방지
- **디버깅**: 각 컬렉션을 독립적으로 확인 가능

## 마이그레이션 절차

### 1. 백업 (필수!)
```bash
# MongoDB 백업
mongodump --uri="your-mongodb-uri" --out=./backup
```

### 2. 마이그레이션 실행
```bash
npm run migrate
```

마이그레이션 스크립트는:
- 기존 데이터를 읽어서 새 구조로 변환
- 트랜잭션으로 안전하게 저장
- 기존 데이터를 `inventories_backup` 컬렉션에 백업
- 실패 시 자동 롤백

### 3. 코드 교체
```bash
# 기존 database.js 백업
cp src/database.js src/database-old.js

# 새 database.js로 교체
mv src/database-new.js src/database.js
```

### 4. 봇 재시작
```bash
npm start
```

### 5. 검증
- 재고 조회 테스트
- 아이템 추가/수정/삭제 테스트
- 레시피 확인
- 태그 확인
- 히스토리 확인

## 롤백 방법

문제가 발생하면 다음과 같이 롤백할 수 있습니다:

### 1. 코드 롤백
```bash
# 기존 database.js 복원
cp src/database-old.js src/database.js
```

### 2. 데이터 롤백
```bash
# MongoDB 백업에서 복원
mongorestore --uri="your-mongodb-uri" --drop ./backup
```

또는 백업 컬렉션에서 복원:
```javascript
// MongoDB shell에서
db.inventories.drop()
db.inventories_backup.find().forEach(doc => {
  delete doc._id;
  db.inventories.insert(doc);
})
```

### 3. 봇 재시작
```bash
npm start
```

## 주의사항

1. **다운타임**: 마이그레이션 중 봇이 일시적으로 중단됩니다 (약 1-2분)
2. **데이터 크기**: 히스토리가 많으면 시간이 더 걸릴 수 있습니다
3. **트랜잭션**: MongoDB 4.0+ 필요 (Replica Set 또는 Sharded Cluster)
4. **백업**: 반드시 백업 후 진행하세요

## 성능 비교

### 기존 구조
- 전체 document 로드: ~500ms (1000개 아이템)
- 특정 아이템 조회: ~500ms (전체 로드 필요)
- 업데이트: ~300ms (전체 document 저장)

### 새 구조
- 전체 아이템 로드: ~200ms (인덱스 활용)
- 특정 아이템 조회: ~10ms (인덱스 직접 조회)
- 업데이트: ~50ms (해당 document만 업데이트)

## 인덱스 정보

자동으로 생성되는 인덱스:
- `inventoryitems`: `{ type: 1, category: 1, name: 1 }` (unique)
- `recipes`: `{ type: 1, category: 1, itemName: 1 }` (unique)
- `tags`: `{ type: 1, category: 1, tagName: 1 }` (unique)
- `histories`: `{ timestamp: -1 }`, `{ type: 1, category: 1, timestamp: -1 }`

## 문제 해결

### 마이그레이션 실패
```
Error: Transaction failed
```
→ MongoDB 버전 확인 (4.0+ 필요), Replica Set 설정 확인

### 중복 키 에러
```
E11000 duplicate key error
```
→ 기존 새 컬렉션 데이터 삭제 후 재시도

### 메모리 부족
```
JavaScript heap out of memory
```
→ Node.js 메모리 증가: `NODE_OPTIONS=--max-old-space-size=4096 npm run migrate`

## 지원

문제가 발생하면:
1. 에러 로그 확인
2. 백업에서 복원
3. 이슈 등록
