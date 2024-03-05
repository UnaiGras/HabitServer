const mongoose = require("mongoose")

const schema = new mongoose.Schema({
    name: {
        type: String,
    },
    challenger: {
        ref: "User",
        type: mongoose.Schema.Types.ObjectId
    },
    challenged: {
        ref: "User",
        type: mongoose.Schema.Types.ObjectId
    },
    habits:[{
        ref: "DuelHabit",
        type: mongoose.Schema.Types.ObjectId
    }],
    challengerPoints: {
        type: Number
    },
    challengedPoints: {
        type: Number
    },
    durationDays: {
        type: Number
    },
    startTime: {
        type: Date
    },
    finishTime: {
        type: Date
    },
    points: {
        type: Number
    }
})


module.exports = mongoose.model('Duel', schema); 