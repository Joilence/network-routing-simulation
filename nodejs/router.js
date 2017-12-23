var dgram = require('dgram');

class Router {
    constructor() {
        this.routeName = '';
        this.routeTable = {};
        this.TopoGraph = {}; // 邻接表存储，仅当 LS 状态使用
        this.mode = ''; // 算法：'ls' | 'dv'
    }

    /**
     * Launch the router
     */

    run(params) {

        listenOn();
    }

    /**
     * Shutdown the router
     */

    shutdown(params) {
        
    }

    /**
     * Main program uses this to send a packet to another router.
     * 
     * @param {String} msg message to send
     * @param {String} dest dest router address
     */

    sendPacket(data, dest) {
        let msg;
        sendTo(dest, msg);
    }

    /** @param {String} destRouter */

    getDestPort(destRouter) {

    }

    /** @param {Object} DVPacket */

    DVUpdateRouteTable(DVPacket) {

    }

    LSUpdateRouteTable(LSPacket) {

    }

    /**
     * @param {String} dest dest router name
     * @param {String} msg message to send
     */

    sendTo(destRouter, msg) {
        var socket = dgram.createSocket('udp4');
        var destPort = getDestPort(destRouter);
        socket.send(msg, destPort, '127.0.0.1');
    }

    listenOn(port) {
        var socketIn = dgram.createSocket('udp4');
        socketIn.bind(port)
        socketIn.on('message', function(msg, rinfo) {
            
        });
    }
}