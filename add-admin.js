const mongoose = require('mongoose');

async function addAdmin() {
  await mongoose.connect('mongodb+srv://rlawogud76:563412@cluster0.cwipf8j.mongodb.net/minecraft-inventory');
  
  const result = await mongoose.connection.db.collection('settings').updateOne(
    { _id: 'global' },
    { $set: { adminUserIds: ['1436225038863831121'] } }
  );
  
  console.log('✅ 관리자 추가 완료:', result.modifiedCount);
  await mongoose.disconnect();
}

addAdmin();
