const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema;

const systemChatLogSchema = new Schema({
    room: {
        type: ObjectId,
        required: true,
        ref: 'Room',
    },
    log: String,
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('SystemChatLog', systemChatLogSchema);