
/**
 * @param {number} dest The port number of dest router
 * @param {Object} data The data object to send
 */
exports.sendTo = function sendTo(dest, data) {
    console.log(`${this.logHead()} sending ${data} to ${dest}`);
    // Query route table
    var entry = this.routeTable.get(dest);
    var outPort = -1;
    if (entry) {
        outPort = entry.toPort;
    } else {
        console.log(`${this.logHead()} unknown router ${this.dest()}`.error);
        return;
    }
    // Get out port number and send packet
    var socket = dgram.createSocket('udp4');
    socket.send(JSON.stringify(data), outPort, '127.0.0.1');
    console.log(`${this.logHead()} has sent ${data.protocol} packet to ${outPort}`);
}

/**
 * @param {number} port The router's port
 */
exports.listenOn = function listenOn(port) {
    var server = dgram.createSocket('udp4');
    server.on('listening', () => {
      const address = server.address();
      console.log(`${this.logHead()} now is listening on ${address.address}:${address.port}`);
    });
    server.on('message', (msg, rinfo) => {
        var packet = JSON.parse(msg);
        console.log(`${this.logHead()} Get ${packet.protocol} packet from ${rinfo.address}:${rinfo.port}`);
        packetHandler(packet);
    });
    server.bind(port);
  }

/**
 * @param { {src, dest, protocol, msg} } packet 
 */
exports.packetHandler = function packetHandler(packet) {
    if (packet.protocol === 'ls') {
        LSStates = JSON.parse(packet.msg);
        this.LSUpdateRouteTable(LSStates);
    } else if (packet.protocol === 'dv') {
        DVStateTable = JSON.parse(package.msg);
        this.DVUpdateRouteTable(DVStateTable);
    } else if (packet.protocol === 'data') {
        if (packet.dest === this.port) {
            console.log(`${this.logHead()} receive message ${packet.msg}`);
            //TODO: store received message
        } else {
            this.sendTo(dest, packet);
        }
    }
}