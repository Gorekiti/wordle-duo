const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = {}; // { id: { name, score } }
let gameState = {
    word: "",
    setter: null, // кто загадывает
    guesser: null, // кто угадывает
    status: "waiting" // waiting, setting, playing
};

io.on('connection', (socket) => {
    // Добавление игрока
    players[socket.id] = { name: `Игрок ${socket.id.substr(0, 4)}`, score: 0 };
    
    io.emit('updatePlayers', players);

    // Логика начала игры
    socket.on('joinGame', () => {
        const ids = Object.keys(players);
        if (ids.length >= 2 && gameState.status === "waiting") {
            gameState.setter = ids[0];
            gameState.guesser = ids[1];
            gameState.status = "setting";
            io.emit('gameStart', gameState);
        }
    });

    // Когда игрок загадал слово
    socket.on('setWord', (word) => {
        if (socket.id === gameState.setter) {
            gameState.word = word.toUpperCase();
            gameState.status = "playing";
            io.emit('wordReady', { length: word.length, guesser: gameState.guesser });
        }
    });

    // Проверка попытки
    socket.on('makeGuess', (guess) => {
        if (socket.id === gameState.guesser) {
            const result = checkWord(guess, gameState.word);
            socket.emit('guessResult', result);
            
            if (guess.toUpperCase() === gameState.word) {
                players[socket.id].score += 1;
                io.emit('gameOver', { winner: players[socket.id].name, word: gameState.word });
                resetState();
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        resetState();
        io.emit('updatePlayers', players);
    });
});

function checkWord(guess, secret) {
    // Простая логика Wordle (массив цветов)
    return guess.toUpperCase().split('').map((char, i) => {
        if (char === secret[i]) return 'correct';
        if (secret.includes(char)) return 'present';
        return 'absent';
    });
}

function resetState() {
    gameState = { word: "", setter: null, guesser: null, status: "waiting" };
    io.emit('resetUI');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));