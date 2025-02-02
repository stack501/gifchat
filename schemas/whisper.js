const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema;
const whisperSchema = new Schema({
    room: {
        type: ObjectId,
        required: true,
        ref: 'Room',
    },
    toUser: {   //귓속말 받은 사람
        type: String,
        required: true,
    },
    fromUser: {     //귓속말 보낸 사람
        type: String,
        required: true,
    },
    chat: String,
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Whisper', whisperSchema);