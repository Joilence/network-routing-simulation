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