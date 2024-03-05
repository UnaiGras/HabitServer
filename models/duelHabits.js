const mongoose = require("mongoose");

const subTaskSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  lastCompletedDate: { type: Date, required: true },
});

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String }, // Asumiendo que quieres un valor por defecto
  desc: { type: String, required: true },
  duration: { type: Number, required: true },
  points: { type: Number, required: true },
  color: { type: String, required: true },
  lastCompletedDate: { type: Date, required: true },
  subTasks: [subTaskSchema],
  challengerLastCompletedDate: { type: Date, required: true },
  challengedLastCompletedDate: { type: Date, required: true },
});

module.exports = mongoose.model('DuelHabit', schema);
