const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};
let hostId = null;
let connectedClients = []; // 💡 접속한 여행자들의 순서를 기억하는 명부

io.on('connection', (socket) => {
    console.log('새로운 여행자 접속:', socket.id);
    connectedClients.push(socket.id);
    
    if (!hostId) hostId = socket.id;
    players[socket.id] = { id: socket.id };

    // 누군가 들어올 때마다 대기실 인원과 순서를 모두에게 방송합니다.
    io.emit('lobbyUpdate', {
        hostId: hostId,
        playerCount: connectedClients.length,
        clients: connectedClients
    });

    socket.emit('init', { id: socket.id, isHost: (socket.id === hostId) });

    socket.on('startGame', (config) => {
        if (socket.id === hostId) io.emit('gameStarted', config);
    });

    // 💡 [영혼의 동기화] 플레이어의 위치, 포탑 건설, 채팅을 다른 차원에 중계합니다.
    socket.on('playerUpdate', (data) => socket.broadcast.emit('playerUpdate', data));
    socket.on('buildTurret', (data) => socket.broadcast.emit('buildTurret', data));
    socket.on('upgradeTurret', (data) => socket.broadcast.emit('upgradeTurret', data));
    socket.on('sellTurret', (data) => socket.broadcast.emit('sellTurret', data));
    socket.on('chatMsg', (data) => socket.broadcast.emit('chatMsg', data));

    socket.on('disconnect', () => {
        console.log('여행자 이탈:', socket.id);
        connectedClients = connectedClients.filter(id => id !== socket.id);
        delete players[socket.id];
        
        if (socket.id === hostId) {
            hostId = connectedClients.length > 0 ? connectedClients[0] : null;
        }
        io.emit('lobbyUpdate', {
            hostId: hostId,
            playerCount: connectedClients.length,
            clients: connectedClients
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`우주의 문이 열렸습니다. PORT: ${PORT}`);
});
