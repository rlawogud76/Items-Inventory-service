// 서버장 ID 설정 스크립트
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rlawogud76:563412@cluster0.cwipf8j.mongodb.net/minecraft-inventory';
const OWNER_ID = '1436225038863831121';

async function setOwner() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('MongoDB 연결됨');
    
    const db = client.db('minecraft-inventory');
    const result = await db.collection('settings').updateOne(
      { _id: 'global' },
      { $set: { serverOwnerId: OWNER_ID } }
    );
    
    console.log('업데이트 결과:', result);
    console.log(`✅ 서버장 ID가 ${OWNER_ID}로 설정되었습니다.`);
    
    // 확인
    const settings = await db.collection('settings').findOne({ _id: 'global' });
    console.log('현재 serverOwnerId:', settings.serverOwnerId);
    
  } catch (error) {
    console.error('오류:', error);
  } finally {
    await client.close();
  }
}

setOwner();
