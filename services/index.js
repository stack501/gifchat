const fs = require('fs/promises');
const path = require('path');

const Room = require('../schemas/room');
const Chat = require('../schemas/chat');
const Whisper = require('../schemas/whisper');
const SystemChatLog = require('../schemas/systemChatLog');

exports.removeRoom = async (roomId) => {
    try {
        await Room.deleteOne({ _id: roomId });
        await Chat.deleteMany({ room: roomId });
        await Whisper.deleteMany({ room: roomId });
        await SystemChatLog.deleteMany({ room: roomId});

        // 업로드 폴더 삭제
        const dirPath = path.join(__dirname, '..', 'uploads', roomId);
        await fs.rm(dirPath, { recursive: true, force: true }); // async 버전
        // force: true -> 폴더가 없어도 에러 안 냄

        console.log(`Room ${roomId} removed, uploads/${roomId} folder deleted.`);
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