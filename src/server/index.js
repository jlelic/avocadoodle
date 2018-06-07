const uuid = require('uuid/v4');
const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const HandshakeMessage = require('../shared/messages/handshake-message');
const DrawMessage = require('../shared/messages/draw-message');
const ChatMessage = require('../shared/messages/chat-message');

const messages = [HandshakeMessage, DrawMessage, ChatMessage];

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));
}

const tokens = {};
const players = {};
const drawHistory = [];
const chatHistory = [];


const wsHandlers = {
  [HandshakeMessage.type]: (socket, data) => {
    const { token } = data;
    const login = tokens[token] || 'TUTULO';
    if (!login) {
      console.error(`Unknown player token ${token}!`);
      return;
    }
    console.log(`Identified player ${login}`);
    socket.emit(HandshakeMessage.type, {name: login});
    drawHistory.forEach((data) => socket.emit(DrawMessage.type ,data));
    chatHistory.forEach((data) => socket.emit(ChatMessage.type ,data));
    players[login] = {};
    delete tokens[token];
  },
  [DrawMessage.type]: (socket, data) => {
    socket.broadcast.emit(DrawMessage.type, data);
    while(drawHistory.length >= 1000) {
      drawHistory.shift();
    }
    drawHistory.push(data)
  },
  [ChatMessage.type]: (socket, data) => {
    socket.broadcast.emit(ChatMessage.type, data);
    while(chatHistory.length >= 10) {
      chatHistory.shift();
    }
    chatHistory.push(data)
  }
};


io.on('connection', (socket) => {
  console.log('New websocket connection.');
  messages.forEach(msg => {
    socket.on(msg.type, data => {
      console.log(`${msg.type}: ${JSON.stringify(data)}`);
      const handler = wsHandlers[msg.type];
      if(!handler){
        console.warn(`No websocket handler for ${msg.type} message type!`);
        return;
      }
      handler(socket, data);
    });
  });
});

// allow cors
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());


app.post('/api/login', (req, res) => {
  console.log(req.body);
  const { login } = req.body;
  const token = uuid();
  tokens[token] = login;
  res.json({ token });
});

server.listen(port, () => console.log(`Game server is listening on ${port}`));
