exports.run = function run(params) {
  listenOn(this.port);
  setInterval(this.LSBroadcastLinkState.bind(this), 30 * 1000);
}

exports.shutdown = function shutdown(params) {

}

exports.connect = function connect(params) {
  this.neighbors.push({
    name: routerInfo.name,
    cost: cost,
    port: routerInfo.port
  })
}

exports.disconnect = function disconnect(params) {

}

exports.switchTo = function switchTo(algorithm) {

}

exports.sendPacket = function sendPacket() {

}

exports.getDestPort = function (routerName) {}

exports.listenOn = function listenOn(port) {
  var server = dgram.createSocket('udp4');
  server.on('listening', () => {
    const address = server.address();
    console.log(`服务器监听 ${address.address}:${address.port}`);
  });
  server.on('message', (msg, rinfo) => {
    console.log(`服务器收到：${msg} 来自 ${rinfo.address}:${rinfo.port}`);
    var packet = JSON.parse(msg);
    if (packet.protocol === 'ls') {
      this.LSHandlePacket(packet);
    }
  });
  server.bind(port);
}