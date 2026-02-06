require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateOwner() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const result = await client.db('minecraft-inventory').collection('settings').updateOne(
    { _id: 'global' },
    { $set: { serverOwnerId: '1217698383553232968' } }
  );
  
  console.log('✅ 서버장이 rosae1026 (1217698383553232968)으로 변경되었습니다.');
  console.log('업데이트:', result.modifiedCount);
  
  await client.close();
}

updateOwner();
