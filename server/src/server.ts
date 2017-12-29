import * as WebSocket from 'ws';
const wss = new WebSocket.Server({ port: 8999 });

wss.on('connection', (ws: WebSocket) => {

  // connection is up, let's add a simple simple event
  ws.on('message', (message: string) => {

    // log the received message and send it back to the client
    console.log('received: %s', message);
    ws.send(`Hello, you sent -> ${message}`);
  });

  // send immediatly a feedback to the incoming connection
  ws.send('Hi there, I am a WebSocket server');
});
