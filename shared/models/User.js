const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Discord ID를 _id로 사용
  _id: { type: String, required: true },
  
  // Discord 유저 정보
  username: { type: String, required: true },
  globalName: { type: String },
  avatar: { type: String },
  
  // 등록 시간
  registeredAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  collection: 'users'
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = { User };
