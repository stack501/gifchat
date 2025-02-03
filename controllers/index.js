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

exports.kickUser = async (req, res, next) => {
    try {
        const currentUser = req.session.color; // 현재 로그인한 사용자 정보 (예: 아이디 혹은 색상)
        const roomId = req.params.id;
        const targetSocketId = userMap[req.body.kickUserColor];

        // 방 정보를 조회 (예: DB에서 roomId로 방 정보를 가져온다)
        const room = await Room.findById(roomId);

        // 현재 사용자가 방장이 아니라면 거부
        if (room.owner !== currentUser) {
            console.error('권한이 없습니다.');
            return res.status(403).send('권한이 없습니다.');
        }
        
        // 강퇴 대상 사용자 처리
        if (!targetSocketId) {
            console.error('해당 사용자를 찾을 수 없습니다.');
            return res.status(404).send('해당 사용자를 찾을 수 없습니다.');
        }

        req.app.get('io')
            .of('/chat')
            .to(targetSocketId)
            .emit('kickUser', { message: '강퇴당하셨습니다' });

        delete userMap[req.body.kickUserColor];

        // 업데이트된 사용자 목록을 객체의 키 배열로 만듭니다.
        const updatedUsers = Object.keys(userMap);
        // 전체 네임스페이스 또는 특정 방에 사용자 목록 업데이트를 broadcast 합니다.
        req.app.get('io')
            .of('/chat')
            .to(roomId)
            .emit('userList', { users: updatedUsers });
    } catch (error) {
        console.error(error);
        next(error);
    }
}

exports.delegateUser = async (req, res, next) => {
    try {
        //위임 대상이 있으면 해당 사용자에 방장 위임
        const targetColor = req.body.delegateUserColor;
        const targetSocketId = userMap[targetColor];
        const roomId = req.params.id;

        // 방 정보를 조회 (예: DB에서 roomId로 방 정보를 가져온다)
        const room = await Room.findById(roomId);

        // 선택된 위임 대상이 이미 방장인 경우
        if (room.owner === targetColor) {
            return;
        }
        
        //위임 대상이 없으면 진행되지 않도록
        if (!targetSocketId) {
            console.error('해당 사용자를 찾을 수 없습니다.');
            return res.status(404).send('해당 사용자를 찾을 수 없습니다.');
        }

        // 새로운 방장(예: 위임 대상)으로 owner 값을 변경합니다.
        room.owner = targetColor;

        // 변경된 room 정보를 DB에 저장합니다.
        await room.save();

        const systemLog = `${targetColor}님이 방장으로 위임되셨습니다.`;

        // 업데이트된 사용자 목록을 객체의 키 배열로 만듭니다.
        const updatedUsers = Object.keys(userMap);
        req.app.get('io')
            .of('/chat')
            .to(roomId)
            .emit('delegateUser', { 
                systemLog,
                targetColor,
                users: updatedUsers,
             });
    } catch (error) {
        console.error(error);
        next(error);
    }
}