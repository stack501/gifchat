const SocketIO = require('socket.io');
const { removeRoom } = require('./services');
const { createSystemChatLog } = require('./services');

module.exports = (server, app, sessionMiddleware) => {
    const io = SocketIO(server, { path: '/socket.io' });

    app.set('io', io);
    const room = io.of('/room');
    const chat = io.of('/chat');
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    chat.use(wrap(sessionMiddleware));

    room.on('connection', (socket) => {
        console.log('room 네임스페이스 접속');
        socket.on('disconnect', () => {
            console.log('room 네임스페이스 접속 해제');
        });
    });
    chat.on('connection', (socket) => {
        console.log('chat 네임스페이스 접속');
        const { referer } = socket.request.headers;
        console.log(referer);
        const roomId = new URL(referer).pathname.split('/').at(-1);
        console.log(roomId);
    
        socket.on('join', async (data) => {
            console.log(data);  //data와 roomId가 같음
            socket.join(data);

            //join 이후에 실행해야만 인원수등을 제대로 가져올 수 있음 (갱신)
            const currentRoom = chat.adapter.rooms.get(roomId);
            const userCount = currentRoom?.size || 0;
            const systemLog = `${socket.request.session.color}님이 입장하셨습니다. 현재 인원: ${userCount}`;

            await createSystemChatLog(roomId, systemLog);

            socket.to(data).emit('join', {
                user: 'system',
                chat: systemLog,
            });

            // 메인 페이지(/room 네임스페이스)에 'updateCount' 이벤트로 알리기
            room.emit('updateCount', { roomId, userCount });
            chat.emit('updateCount', {
                roomId,
                occupantCount: userCount,
              });
        });

        // ============ leaveRoom 이벤트 추가 ============
        socket.on('leaveRoom', async (roomId, done) => {
            // 1) 소켓이 해당 방을 떠남
            socket.leave(roomId);
    
            // 2) 남은 인원 파악
            const userCount = chat.adapter.rooms.get(roomId)?.size || 0;
            console.log(`방 ${roomId} 인원: ${userCount}`);
    
            if (userCount === 0) {
                // 마지막 인원이므로 방 삭제
                await removeRoom(roomId);
                // 메인 페이지(/room 네임스페이스)에 'removeRoom' 이벤트
                room.emit('removeRoom', roomId);
                console.log('방 제거 완료');
                // 클라이언트 콜백에 "success: true" 전달
                done({ success: true });
            } else {
                const systemLog = `${socket.request.session.color}님이 퇴장하셨습니다. 현재 인원: ${userCount}`;
                
                await createSystemChatLog(roomId, systemLog);

                socket.to(roomId).emit('exit', {
                    user: 'system',
                    chat: systemLog,
                });

                chat.emit('updateCount', { roomId, occupantCount: userCount });
                done({ success: false });
            }
        });

        socket.on('disconnect', async () => {
            console.log('chat 네임스페이스 접속 해제');
            
            const currentRoom = chat.adapter.rooms.get(roomId);
            const userCount = currentRoom?.size || 0;
            if(userCount === 0) {
                await removeRoom(roomId);
                room.emit('removeRoom', roomId);
                console.log('방 제거 요청 성공');
            }
        });
    });
}