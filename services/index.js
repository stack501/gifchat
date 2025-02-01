const Room = require('../schemas/room');
const Chat = require('../schemas/chat');
const SystemChatLog = require('../schemas/systemChatLog');

exports.removeRoom = async (roomId) => {
    try {
        await Room.deleteOne({ _id: roomId });
        await Chat.deleteMany({ room: roomId });
    } catch (error) {
        throw error;
    }
};

exports.createSystemChatLog = async (roomId, log) => {
    try {
        await SystemChatLog.create({
            room: roomId,
            log: log,
        });
    } catch (error) {
        throw error;
    }
}