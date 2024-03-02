const mongoose = require("mongoose");


const schema = new mongoose.Schema({
  from: {
    ref: "User",
    type: mongoose.Schema.Types.ObjectId
  },
  to: {
    ref: "User",
    type: mongoose.Schema.Types.ObjectId
  },
  duel: {
    ref: "Duel",
    type: mongoose.Schema.Types.ObjectId
  },
  sendingDate: {
    type: Date
  },
  status: {
      type: String
  }
});

module.exports = mongoose.model('DuelRequest', schema);