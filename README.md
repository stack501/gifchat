# 웹소켓 GIF 채팅 서버

## 프로젝트 설정
```js
npm i cookie-parset dotenv express express-session morgan nunjucks && npm i -D nodemon
npm i ws
npm i socket.io
```

## 1. WS 모듈 사용하기

### app.js
```js
// 1. 서버 생성 후 포트 리스닝
const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기중');
});

// 2. 생성된 서버 인스턴스를 WebSocket 로직에 전달
websocket(server);
```
#### 1. app.listen(...):
- app.listen(app.get('port'), ...) 구문은 지정된 포트에서 HTTP 서버를 열고 요청을 받을 준비를 합니다.
- app.get('port')는 app.set('port', 값)을 통해 설정해둔 포트 번호(혹은 .env에서 불러온 포트 번호)입니다.
- 이 리스너 함수는 비동기로 서버가 성공적으로 시작되었을 때 호출되며, 콘솔에 현재 포트가 출력됩니다.
- listen 메서드의 반환값은 Node.js의 HTTP 서버 객체이므로, server 변수에는 실제 서버 인스턴스가 할당됩니다.
#### 2. websocket(server):
- websocket(server)는 바로 앞에서 생성된 HTTP 서버 인스턴스를 WebSocket(혹은 Socket.IO 등) 서버로 확장하거나 연동하는 역할을 합니다.
- 이 함수를 통해 웹소켓 통신을 위한 실시간 양방향 연결(브라우저와 서버 간)을 가능하게 해줍니다.

### websocket.js
```js
const Websocket = require('ws');

module.exports = (server) => {
    const wss = new Websocket.Server({ server });

    wss.on('connection', (ws, req) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log('새로운 클라이언트 접속', ip);
        //클라이언트로부터 메세지가 온 경우 (버퍼)
        ws.on('message', (message) => {
            console.log(message.toString());
        });
        ws.on('error', console.error);
        ws.on('close', () => {
            console.log('클라이언트 접속 해제', ip);
            clearInterval(ws.interval);
        });
        ws.interval = setInterval(() => {
            if(ws.readyState === ws.OPEN) {
                ws.send('서버에서 클라이언트로 메시지를 보냅니다');
            }
        }, 3000);
    });
}
```
#### 1. module.exports = (server) => { ... }
- 이 부분은 이미 만들어진 서버 인스턴스(예: Express 서버)를 인자로 받아, 그 위에 WebSocket 서버를 올리는 함수 형태입니다.
- **server**가 일반적인 HTTP 서버 역할을 맡고 있다면, **같은 포트**에서 WebSocket 연결도 함께 처리할 수 있게 만듭니다.
#### 2. const wss = new Websocket.Server({ server });
- **wss**는 new Websocket.Server()로 생성한 WebSocket 서버 인스턴스입니다.
- { server } 옵션을 통해, 기존의 HTTP 서버 객체에 업그레이드 요청(HTTP -> WS)을 연결시킵니다.
- 이렇게 하면 /socket 같은 endpoint(경로) 없이도 특정 헤더(Upgrade: websocket)를 통해 WebSocket 통신을 시작할 수 있게 됩니다.
#### 3. wss.on('connection', (ws, req) => { ... })
- 새로운 클라이언트가 WebSocket 연결을 맺었을 때 발생하는 이벤트입니다.
- 콜백의 ws는 서버와 연결된 WebSocket 객체이며, req는 초기 연결 시도의 HTTP 요청 정보를 담고 있습니다(헤더, IP 등).
##### 3-1. IP 추출
```js
const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
console.log('새로운 클라이언트 접속', ip);
```
- 실제 클라이언트의 IP를 알아내는 코드입니다.
- x-forwarded-for 헤더는 프록시나 로드밸런서를 거쳤을 때 원본 IP를 담고 있을 수 있습니다.
- 만약 해당 헤더가 없으면 req.socket.remoteAddress를 사용합니다.

##### 3-2. 이벤트 핸들러들
```js
ws.on('message', (message) => {
    console.log(message.toString());
});
ws.on('error', console.error);
ws.on('close', () => {
    console.log('클라이언트 접속 해제', ip);
    clearInterval(ws.interval);
});
```
- ws.on('message', ...): 클라이언트가 메시지를 보내면(보통 Buffer 또는 string 형태) 호출됩니다.
- 예시에서는 message.toString()으로 로그만 찍고 있습니다.
- 실제 서비스에서는 여기서 JSON 파싱, 명령 분기 등의 작업을 수행합니다.
- ws.on('error', ...): WebSocket 통신 중 오류가 발생하면 호출됩니다.
- 여기서는 console.error로 바로 오류를 출력하게끔 작성되어 있습니다.
- ws.on('close', ...): 클라이언트가 연결을 끊거나 서버에서 종료한 경우 발생합니다.
- 연결 해제 시, clearInterval(ws.interval);로 주기적으로 메시지를 보내던 타이머를 정리(해제)하여 메모리 누수나 불필요한 동작을 막습니다.

##### 3-3. ws.interval = setInterval(() => { ... }, 3000);
```js
ws.interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
        ws.send('서버에서 클라이언트로 메시지를 보냅니다');
    }
}, 3000);
```
- 3초마다 서버가 클라이언트로 메시지를 보내는 예시 로직입니다.
- ws.readyState === ws.OPEN 조건을 확인하는 이유는, 만약 WebSocket이 이미 닫혀있거나 종료 상태라면 ws.send()가 오류를 일으킬 수 있기 때문입니다.
- 이처럼 주기적인 서버->클라이언트 알림을 테스트하거나, 특정 이벤트를 클라이언트에 주기적으로 전파할 때 활용합니다.

## 2. Socket.IO 모듈 사용하기
### socket.js
```js
const SocketIO = require('socket.io');

module.exports = (server) => {
    const io = SocketIO(server, { path: '/socket.io' });

    io.on('connection', (socket) => {
        const req = socket.request;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log('새로운 클라이언트 접속', ip, socket.id);
        
        socket.on('disconnect', () => {
            console.log('클라이언트 접속 해제', ip, socket.id);
            clearInterval(socket.interval);
        });
        socket.on('reply', (data) => {
            console.log(data);
        });
        socket.on('error', console.error);
        socket.interval = setInterval(() => {
            socket.emit('news', 'Hello Socket.IO');
        }, 3000);
    });
}
```
#### 1. Socket.IO 서버 초기화
```js
const SocketIO = require('socket.io');

module.exports = (server) => {
    const io = SocketIO(server, { path: '/socket.io' });
    ...
}
```
- server: 기존에 만들어진 Node.js HTTP 서버(주로 app.listen(...)으로 생성한 객체)를 전달합니다.
- { path: '/socket.io' }: 웹소켓 업그레이드 경로를 지정합니다. 일반적으로 기본값은 /socket.io이지만, 명시적으로 적어둔 모습입니다.
- 이렇게 초기화하면, Socket.IO 서버가 해당 HTTP 서버 위에서 WebSocket 통신을 처리할 준비를 합니다.

#### 2. 새 클라이언트 소켓 연결 시 처리
```js
io.on('connection', (socket) => {
    const req = socket.request;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log('새로운 클라이언트 접속', ip, socket.id);
    ...
});
```

- io.on('connection', ...): 클라이언트(브라우저 등)가 Socket.IO를 통해 서버에 연결하면 실행됩니다.
- socket.request: 기존 HTTP 요청 정보에 접근할 수 있습니다. (예: 세션, 헤더, 쿠키 등)
- IP 추출: x-forwarded-for 헤더는 프록시나 로드 밸런서를 거친 경우 클라이언트의 원본 IP를 가져올 수 있고, 없으면 req.socket.remoteAddress를 사용합니다.
- socket.id: 소켓 서버에서 부여한 고유 식별자입니다. 로그 분석 등에 유용합니다.

#### 3. 이벤트 핸들링
```js
socket.on('disconnect', () => {
    console.log('클라이언트 접속 해제', ip, socket.id);
    clearInterval(socket.interval);
});
socket.on('reply', (data) => {
    console.log(data);
});
socket.on('error', console.error);
```
- socket.on('disconnect', ...): 클라이언트가 연결을 끊거나 네트워크 장애 등으로 소켓이 닫힐 때 호출됩니다.
  + 여기서는 console.log로 해제 로그를 남기고, socket.interval(아래에서 설명할 타이머)을 정리(clearInterval)합니다.
- socket.on('reply', ...): 클라이언트에서 'reply'라는 이벤트로 메시지를 보내면, 이 콜백에서 해당 메시지(data)를 처리합니다.
  + 예: 클라이언트 측 socket.emit('reply', { msg: 'Hello Server' })가 오면 서버 측에서 이 이벤트를 받습니다.
- socket.on('error', console.error): 소켓 통신 오류 발생 시, 오류 내용을 바로 콘솔에 출력합니다.

## 3. 실시간 채팅방 만들기
### 3.1. 채팅방 생성
#### main.html
- 방 목록을 테이블 형태로 출력. 비밀방/공개방, 허용 인원, 방장 컬러 등.
- Socket.IO를 /room 네임스페이스에 연결해, newRoom, removeRoom 이벤트를 처리.
- 비밀번호가 있는 방이면, prompt로 비밀번호를 입력받아 쿼리스트링으로 전달.

#### room.html
- 방 생성 폼 -> 제출 시 POST /room 라우터로 이동 -> DB에 방 생성 + /room 네임스페이스로 newRoom 이벤트.

#### chat.html
- **io.connect('/chat')** 로 채팅 네임스페이스 연결 -> socket.emit('join', 방_id)로 방에 참가.
- socket.on('join'), socket.on('exit'), socket.on('chat') 등 이벤트 핸들러로 실시간 채팅 메시지 처리(HTML 동적 업데이트).
- **axios**를 써서 폼 데이터를 서버에 전송 -> 서버에서 채팅 DB 저장 -> 다시 Socket.IO를 통해 모든 클라이언트에 메시지 broadcast 가능(코드 상 구현은 생략 or 다른 부분에서).

#### socket.js (Socket.IO 설정)
```js
const SocketIO = require('socket.io');
module.exports = (server, app) => {
    const io = SocketIO(server, { path: '/socket.io' });
    app.set('io', io); // Express 전역으로 io 인스턴스 등록

    const room = io.of('/room');
    const chat = io.of('/chat');
    ...
};
```
1. io 생성: 기존 HTTP 서버를 기반으로 Socket.IO 서버 생성. 경로(path: '/socket.io')를 설정.
2. 전역 등록: app.set('io', io)로 Express 앱 전체에서 req.app.get('io')로 Socket.IO 인스턴스 접근 가능.
3. 네임스페이스:
- /room 네임스페이스: 방 관련 이벤트 (새 방 생성 알림, 방 목록 업데이트 등)
- /chat 네임스페이스: 실제 채팅 메시지 주고받는 공간

```js
room.on('connection', (socket) => {
  console.log('room 네임스페이스 접속');
  socket.on('disconnect', () => {
    console.log('room 네임스페이스 접속 해제');
  });
});
chat.on('connection', (socket) => {
  console.log('chat 네임스페이스 접속');
  socket.on('join', (data) => {
    socket.join(data); // 방 _id를 room으로 사용
  });
  socket.on('disconnect', () => {
    console.log('chat 네임스페이스 접속 해제');
  });
});
```
- socket.join(data): 클라이언트가 특정 방(예: MongoDB Room._id)에 join할 수 있게 함.
- 나중에 io.of('/chat').to(방_id).emit('이벤트', 데이터) 식으로 해당 방에만 메시지를 보낼 수 있음.

#### routes/index.js (라우터)
- renderMain: 메인 화면 렌더링
- renderRoom: 방 생성 폼 페이지
- createRoom: 실제 방 생성 처리(DB 저장, Socket.IO로 새 방 이벤트)
- enterRoom: 특정 방 입장 로직(비밀번호 검증, 인원 제한 확인) 후 채팅 페이지로
- removeRoom: 방과 해당 방의 채팅 기록 삭제

각 함수는 controllers/index.js에서 정의한 로직을 연결합니다.

#### controllers/index.js (비즈니스 로직)
##### 1. exports.renderMain
```js
exports.renderMain = async (req, res, next) => {
    try {
        const rooms = await Room.find({});
        res.render('main', { rooms, title: 'GIF 채팅방' });
    } catch (error) {
        next(error);
    }
};
```
- DB에서 모든 방 목록을 가져와 main.html 템플릿에 렌더링.
- rooms 배열에는 title, max, password, owner 등 방 정보가 담김.

##### 2. exports.renderRoom
```js
exports.renderRoom = (req, res) => {
    res.render('room', { title: 'GIF 채팅방 생성' });
};
```
- 방 생성 폼 페이지(입력 UI) 렌더링.

##### 3. exports.createRoom
```js
exports.createRoom = async (req, res, next) => {
    try {
        const newRoom = await Room.create({
            title: req.body.title,
            max: req.body.max,
            owner: req.session.color,
            password: req.body.password,
        });
        const io = req.app.get('io');
        io.of('/room').emit('newRoom', newRoom); // 새 방 이벤트
        if (req.body.password) {
            res.redirect(`/room/${newRoom._id}?password=${req.body.password}`);
        } else {
            res.redirect(`/room/${newRoom._id}`);
        }
    } catch (error) {
        next(error);
    }
};
```
- 새 Room 문서를 DB에 저장. (폼에서 받은 title, max, password 등)
- Socket.IO 인스턴스를 가져와서(/room 네임스페이스)
- emit('newRoom', newRoom) -> 접속해 있는 클라이언트들에 “새 방 추가” 알림.
- 입장 페이지로 리다이렉트 (비번이 있다면 URL 쿼리로 전달).

##### 4. exports.enterRoom
```js
exports.enterRoom = async (req, res, next) => {
    try {
        const room = await Room.findOne({ _id: req.params.id });
        if(!room) return res.redirect('/?error=존재하지 않는 방입니다.');
        if(room.password && room.password !== req.query.password) {
            return res.redirect('/?error=비밀번호가 틀렸습니다.');
        }
        const io = req.app.get('io');
        const { rooms } = io.of('/chat').adapter;
        if(room.max <= rooms.get(req.params.id)?.size) {
            return res.redirect('/?error=허용 인원을 초과했습니다.');
        }
        res.render('chat', { title: 'GIF 채팅방 생성', chats: [], user: req.session.color });
    } catch (error) {
        next(error);
    }
};
```
- DB에서 방 찾기: _id가 존재하지 않으면 에러.
- 비번 확인: URL 쿼리에 담긴 비밀번호 vs DB 저장 비밀번호. 불일치 시 에러.
- 인원 제한: Socket.IO **adapter.rooms**를 통해 현재 /chat 네임스페이스의 방들 조회 -> 만약 현재 인원(size)이 max 이상이면 에러.
- 채팅 화면 렌더링: chat.html에 유저 정보(req.session.color)와 초기 채팅(chats: []) 전달.

##### 5. exports.removeRoom
```js
exports.removeRoom = async (req, res, next) => {
    try {
        await Room.remove({ _id: req.params.id });
        await Chat.remove({ room: req.params.id });
        res.send('ok');
    } catch (error) {
        next(error);
    }
};
```
- 해당 Room과 관련된 Chat 모두 DB에서 제거.
- 클라이언트는 AJAX 요청 등으로 ‘ok’ 응답을 받아 처리할 수 있음.
- 추가로, Socket.IO로 “removeRoom” 이벤트를 보내서 클라이언트 쪽에서도 방 목록에서 제거하는 로직이 구현될 수 있습니다(코드 내 socket.on('removeRoom', ...)).
