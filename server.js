const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 💡 전역 상태 관리
let players = {}; 
let hostId = null; 
let clientList = []; // 접속 순서를 유지하기 위한 리스트

io.on('connection', (socket) => {
    console.log('🚀 새로운 여행자 접속:', socket.id);
    
    // 1. 플레이어 등록 및 리스트 관리
    players[socket.id] = { id: socket.id };
    clientList.push(socket.id);

    // 2. 첫 접속자 혹은 방장이 없는 경우 지휘자(방장) 임명
    if (!hostId || !players[hostId]) {
        hostId = clientList[0];
    }

    // 3. 로비 정보 갱신 (모든 클라이언트에게 전송)
    const sendLobbyUpdate = () => {
        io.emit('lobbyUpdate', {
            hostId: hostId,
            playerCount: clientList.length,
            clients: clientList
        });
    };
    sendLobbyUpdate();

    // 4. 개별 클라이언트 초기화 정보 전송
    socket.emit('init', { 
        id: socket.id, 
        isHost: (socket.id === hostId) 
    });

    // 💡 [이벤트] 게임 시작 신호
    socket.on('startGame', (config) => {
        if (socket.id === hostId) {
            console.log('🎮 게임 시작 신호 발송');
            io.emit('gameStarted', config);
        }
    });

    // 💡 [핵심] 참가자의 입력(위치 등)을 방장에게만 전달
    socket.on('playerInput', (data) => {
        if (hostId && socket.id !== hostId) {
            // 방장에게 'remoteInput'이라는 이름으로 참가자의 데이터를 전달
            io.to(hostId).emit('remoteInput', data);
        }
    });

    // 💡 [핵심] 방장의 게임 상태(몬스터, 공, 아이템)를 모든 참가자에게 전달
    socket.on('syncState', (stateData) => {
        if (socket.id === hostId) {
            // 방장을 제외한 모든 사람에게 브로드캐스트
            socket.broadcast.emit('updateState', stateData);
        }
    });

    // 💡 [기능] 채팅 메시지 중계
    socket.on('chatMsg', (data) => {
        // 보낸 사람 제외하고 모두에게 전달
        socket.broadcast.emit('chatMsg', data);
    });

    // 💡 [기능] 포탑 설치/업그레이드/판매 동기화
    socket.on('buildTurret', (data) => { socket.broadcast.emit('buildTurret', data); });
    socket.on('upgradeTurret', (data) => { socket.broadcast.emit('upgradeTurret', data); });
    socket.on('sellTurret', (data) => { socket.broadcast.emit('sellTurret', data); });

    // 5. 접속 종료 처리
    socket.on('disconnect', () => {
        console.log('🛸 여행자 이탈:', socket.id);
        
        // 리스트에서 제거
        clientList = clientList.filter(id => id !== socket.id);
        delete players[socket.id];

        // 방장이 나갔을 경우 다음 순번에게 권한 위임
        if (socket.id === hostId) {
            hostId = clientList.length > 0 ? clientList[0] : null;
            
            // 새로운 방장에게 자신이 방장임을 알림
            if (hostId) {
                io.to(hostId).emit('init', { id: hostId, isHost: true });
            }
        }
        
        sendLobbyUpdate();
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`
    ====================================================
    🌌 우주의 문이 열렸습니다. 
    📍 주소: http://localhost:${PORT}
    ====================================================
    `);
});
