const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  allDay: { type: Boolean, default: true },
  color: { type: String, default: 'blue', enum: ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] },
  
  // 반복 설정
  repeat: { type: String, default: 'none', enum: ['none', 'daily', 'weekly', 'monthly'] },
  repeatEndDate: { type: Date },
  
  // 생성자 정보
  createdBy: { type: String, required: true },
  createdByName: { type: String, default: '' }
}, { 
  timestamps: true,
  collection: 'events'
});

eventSchema.index({ startDate: 1 });
eventSchema.index({ endDate: 1 });

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
module.exports = { Event };
