exports.sendTo = function sendTo(destRouter, msg) {
  var socket = dgram.createSocket('udp4');
  socket.send(JSON.stringify(msg), destRouter, '127.0.0.1');
}

exports.listen = function listen(params) {
    
}

exports.packetHandler = function packetHandler(params) {
}