var dgram = require('dgram');

class Router {
    constructor() {
        this.name = '';
        this.port = '';
        this.routeTable = [];
        this.TopoGraph = {}; // 邻接表存储，仅当 LS 状态使用
        this.mode = ''; // 算法：'ls' | 'dv'
    }

    /**
     * Control Part
     * - control and config the router
     */

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
     * Conect to a router
     * @param {String} routerName
     * @param {number} routerPort
     */

    connectRouter(routerInfo) {
        this.routeTable.push({
            type: 'C',
            name: routerInfo.name,
            cost: cost,
            port: routerInfo.port
        })
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

    /**
     * Route Part
     * - broadcasts the packet of specific algorithm
     * - update the router's route table
     * - route
     */

    /** @param {String} destRouter */

    getDestPort(destRouter) {

    }

    /** @param {Object} DVPacket */

    DVUpdateRouteTable(DVPacket) {

    }

    /**
     * 
     */
    broadcastDV() {
        for (var entry in this.routeTable) {
            if (entry.type === 'C') {
                sendTo(entry.port, genDVPacket())
            }
        }
    }

    genDVPacket() {

    }

    LSUpdateRouteTable(LSPacket) {

    }

    /**
     * IO Part
     * This part of methods is in charge of IO
     */

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

    /**
     * Info Part
     * - give related information
     */

     get routerInfo() {
         return {
             name: this.name,
             port: this.port
         }
     }
}