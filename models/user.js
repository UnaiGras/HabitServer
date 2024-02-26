
const mongoose = require("mongoose")

const schema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
       type: String,
       required: true
    },
    name: {
        type: String,
        required: true,

    },
    psswdHash: {
        type: String,
        required: true,
    },
    premium: {
        type: Boolean
    }
})


module.exports = mongoose.model('User', schema); 