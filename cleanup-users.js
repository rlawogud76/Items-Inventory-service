const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://rlawogud76:563412@cluster0.cwipf8j.mongodb.net/minecraft-inventory';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결됨');

    const db = mongoose.connection.db;

    // 1. users 컬렉션 전체 삭제
    const usersResult = await db.collection('users').deleteMany({});
    console.log(`🗑️ users 삭제: ${usersResult.deletedCount}개`);

    // 2. settings에서 관리자 정보 초기화
    const settingsResult = await db.collection('settings').updateOne(
      { _id: 'global' },
      { $set: { adminUserIds: [], serverOwnerId: null } }
    );
    console.log(`🔧 settings 업데이트: ${settingsResult.modifiedCount}개`);

    console.log('✅ 유저 관련 데이터 초기화 완료!');
  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanup();
