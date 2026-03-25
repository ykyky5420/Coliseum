const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// 'public' 폴더 안의 파일들(index.html 등)을 화면에 띄워줍니다.
app.use(express.static('public')); 

let players = {};
let hostId = null;

io.on('connection', (socket) => {
    console.log('새로운 여행자 접속:', socket.id);
    
    // 첫 접속자를 우주의 지휘자(방장)로 임명합니다.
    if (!hostId) hostId = socket.id;

    players[socket.id] = { id: socket.id, keys: {}, joy: {x:0, y:0} };

    // 접속한 플레이어에게 자신의 신분과 방장 정보를 알립니다.
    socket.emit('init', { id: socket.id, isHost: (socket.id === hostId) });

    // 플레이어의 움직임 입력을 받으면 방장에게만 은밀히 전달합니다.
    socket.on('playerInput', (data) => {
        players[socket.id].keys = data.keys;
        players[socket.id].joy = data.joy;
        if (hostId && socket.id !== hostId) {
            io.to(hostId).emit('remoteInput', { id: socket.id, input: data });
        }
    });

    // 방장이 연산한 우주의 현재 상태(몬스터 위치 등)를 모두에게 방송합니다.
    socket.on('syncState', (stateData) => {
        if (socket.id === hostId) {
            socket.broadcast.emit('updateState', stateData);
        }
    });

    // 누군가 우주를 떠났을 때의 처리
    socket.on('disconnect', () => {
        console.log('여행자 이탈:', socket.id);
        delete players[socket.id];
        
        // 방장이 떠났다면 다음 사람에게 지휘권을 넘깁니다.
        if (socket.id === hostId) {
            let remaining = Object.keys(players);
            if (remaining.length > 0) {
                hostId = remaining[0];
                io.to(hostId).emit('becomeHost');
            } else {
                hostId = null;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`우주의 문이 열렸습니다. PORT: ${PORT}`);
});