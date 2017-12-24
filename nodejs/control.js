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
  this.neighbors.length = 0;
  this.routeTable.clear();
  console.log(`${this.logHead()} has cleared.`);
}

/**
 * 
 * @param { {name, port} } router 
 */
exports.connect = function connect(router, cost) {
  // Add into neighbors
  this.neighbors.set(router.port, cost);
  // Add into route table
  this.routeTable.set(router.port, {
    cost: cost,
    toPort: router.port,
    timestamp: undefined
  });
  console.log(`${this.logHead()} connect with ${router.port}`);
}

exports.disconnect = function disconnect(router) {
    this.neighbors.delete(router.port);
    this.routeTable.delete(router.port);
    console.log(`${this.logHead()} disconnect with ${router.port}`);
}

exports.switchTo = function switchTo(algorithm) {
    console.log(`${this.logHead()} resetting...`);
    this.reset();
    this.algorithm = algorithm;
    this.run();
    console.log(`${this.logHead()} reset to ${algorithm}`);
}

exports.sendPacket = function sendPacket(dest, msg) {
    this.sendTo(dest, {
        src: this.port,
        dest: dest,
        protocol: 'data',
        msg: msg
    });
}