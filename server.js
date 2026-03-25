const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};
let hostId = null;

io.on('connection', (socket) => {
    console.log('새로운 여행자 접속:', socket.id);
    
    // 💡 첫 접속자를 지휘자(방장)로 임명
    if (!hostId) hostId = socket.id;

    players[socket.id] = { id: socket.id };

    // 💡 누군가 들어올 때마다 대기실 인원을 모두에게 방송합니다.
    io.emit('lobbyUpdate', {
        hostId: hostId,
        playerCount: Object.keys(players).length,
        players: players
    });

    socket.emit('init', { id: socket.id, isHost: (socket.id === hostId) });

    // 💡 방장이 시작 버튼을 누르면 모두에게 게임 시작을 알립니다.
    socket.on('startGame', (config) => {
        if (socket.id === hostId) {
            io.emit('gameStarted', config);
        }
    });

    socket.on('playerInput', (data) => {
        if (hostId && socket.id !== hostId) {
            io.to(hostId).emit('remoteInput', { id: socket.id, input: data });
        }
    });

    socket.on('syncState', (stateData) => {
        if (socket.id === hostId) {
            socket.broadcast.emit('updateState', stateData);
        }
    });

    socket.on('disconnect', () => {
        console.log('여행자 이탈:', socket.id);
        delete players[socket.id];
        
        // 💡 방장이 떠나면 다음 사람에게 지휘권을 넘깁니다.
        if (socket.id === hostId) {
            let remaining = Object.keys(players);
            if (remaining.length > 0) {
                hostId = remaining[0];
            } else {
                hostId = null;
            }
        }
        
        // 💡 누군가 나갔을 때도 대기실 인원을 갱신합니다.
        io.emit('lobbyUpdate', {
            hostId: hostId,
            playerCount: Object.keys(players).length,
            players: players
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`우주의 문이 열렸습니다. PORT: ${PORT}`);
});
