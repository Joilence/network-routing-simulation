exports.run = function run() {
  if (this.state === true) {
    console.log(`${this.logHead()} already running on ${this.port}`);
    return;
  }
  listenOn(this.port);
  if (this.algorithm === 'ls') {
    this.LSBroadcastTimer = setInterval(this.LSBroadcastLinkState.bind(this), 30 * 1000);
  } else if (this.algorithm === 'dv') {
    this.DVBroadcastTimer = setInterval(this.DVBroadcastStateTable.bind(this), 30 * 1000);
  } else {
    console.log(`${this.logHead} unkonwn algorithm ${this.algorithm}`.error);
  }
  this.state = true;
}

exports.shutdown = function shutdown(params) {
  if (this.state === false) {
    console.log(`${this.logHead()} already shutdown`);
    return;
  }
  clearInterval(LSBroadcastTimer);
  clearInterval(DVBroadcastTimer);
}

exports.reset = function reset() {
  if (this.state === true) {
    this.shutdown();
  }
  this.neighbours.length = 0;
  this.routeTable.clear();
  console.log(`${this.logHead()} has cleared.`);
}

/**
 * 
 * @param { {name, port} } router 
 */
exports.connect = function connect(router, cost) {
  // Add into neighbours
  this.neighbours.push({
    name: router.name,
    cost: cost,
    port: router.port
  })
  // Add into route table
  this.routeTable.
}

exports.disconnect = function disconnect(router) {

}

exports.switchTo = function switchTo(algorithm) {

}

exports.sendPacket = function sendPacket() {

}

exports.getDestPort = function (routerName) {}