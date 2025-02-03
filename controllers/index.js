const Room = require('../schemas/room');
const Chat = require('../schemas/chat');
const Whisper = require('../schemas/whisper');
const { removeRoom: removeRoomService } = require('../services');
const { userMap } = require('../socket');

exports.renderMain = async (req, res, next) => {
    try {
        const rooms = await Room.find({});
        const { rooms: chatRooms } = req.app.get('io').of('/chat').adapter;
        const roomWithCount = rooms.map((room) => {
            const roomId = room._id.toString();
            const occupantCount = chatRooms.get(roomId)?.size || 0;
            return {
                ...room._doc,   //Mongoose 문서를 JS 객체로 펼쳐줌
                occupantCount,
            };
        });

        res.render('main', { 
            rooms: roomWithCount, 
            title: 'GIF 채팅방',
         });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
exports.renderRoom = (req, res, next) => {
    res.render('room', { title: 'GIF 채팅방 생성' });
};
exports.createRoom = async (req, res, next) => {
    try {
        const newRoom = await Room.create({
            title: req.body.title,
            max: req.body.max,
            owner: req.session.color,
            password: req.body.password,
        });
        const io = req.app.get('io');
        io.of('/room').emit('newRoom', newRoom);
        if (req.body.password) {
            res.redirect(`/room/${newRoom._id}?password=${req.body.password}`);
        } else {
            res.redirect(`/room/${newRoom._id}`);
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
};
exports.enterRoom = async (req, res, next) => {
    try {
        const room = await Room.findOne({ _id: req.params.id });
        if(!room) {
            return res.redirect('/?error=존재하지 않는 방입니다.');
        }
        if(room.password && room.password !== req.query.password) {
            return res.redirect('/?error=비밀번호가 틀렸습니다.');
        }
        const io = req.app.get('io');
        const { rooms } = io.of('/chat').adapter;

        // 현재 인원 계산
        const occupantCount = rooms.get(req.params.id)?.size || 0;

        if(room.max <= occupantCount) {
            return res.redirect('/?error=허용 인원을 초과했습니다.');
        }
        const chats = await Chat.find({ room: room._id }).sort('createdAt');
        res.render('chat', { title: `GIF 채팅방 생성 (현재 인원: ${occupantCount}명)`, chats, room, user: req.session.color });   
    } catch (error) {
        console.error(error);
        next(error);
    }
};
// exports.removeRoom = async (req, res, next) => {
//     try {
//         await removeRoomService(req.params.id);
//         res.send('ok');
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };
exports.sendWhisper = async (req, res, next) => {
    try {
        const whisper = await Whisper.create({
            room: req.params.id,
            toUser: req.body.toUser,
            fromUser: req.session.color,
            chat: req.body.chat,
        });

        const targetSocketId = userMap[req.body.toUser];
        const senderSocketId = userMap[req.session.color];
        req.app.get('io')
            .of('/chat')
            .to(targetSocketId)
            .emit('whisper', whisper);

        req.app.get('io')
            .of('/chat')
            .to(senderSocketId)
            .emit('whisper', whisper);
        res.send('ok');
    } catch (error) {
        console.error(error);
        next(error);
    }
}
exports.sendChat = async (req, res, next) => {
    try {
        const chat = await Chat.create({
            room: req.params.id,
            user: req.session.color,
            chat: req.body.chat,
        });
        req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
        res.send('ok');
    } catch (error) {
        console.error(error);
        next(error);
    }
}
exports.sendGif = async (req, res, next) => {
    try {
        const chat = await Chat.create({
            room: req.params.id,
            user: req.session.color,
            gif: req.file.filename,
        });
        req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
        res.send('ok');
    } catch (error) {
        console.error(error);
        next(error);
    }
}