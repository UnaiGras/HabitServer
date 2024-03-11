const mongoose = require("mongoose");

const subTaskSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  lastCompletedDate: { type: Date},
});

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String }, // Asumiendo que quieres un valor por defecto
  desc: { type: String, required: true },
  duration: { type: Number, required: true },
  points: { type: Number, required: true },
  color: { type: String, required: true },
  lastCompletedDate: { type: Date },
  subTasks: [subTaskSchema],
  challengerLastCompletedDate: { type: Date},
  challengedLastCompletedDate: { type: Date },
});

module.exports = mongoose.model('DuelHabit', schema);
