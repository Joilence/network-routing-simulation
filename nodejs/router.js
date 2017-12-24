import {
    setInterval
} from 'timers';

var dgram = require('dgram');

class Router {
    /**
     * @description 路由器监听通告的端口，我们用此整数作为路由器的标志
     * @memberof Router
     */
    port;
    /**
     * @description 直连的路由器。
     * 算法为ls时，直接将它广播（当然，还要附带本路由器的port）
     * type: [{name, port, cost}]
     * @memberof Router
     */
    neighbors;
    /**
     * @description 路由算法：'ls' | 'dv'
     * @memberof Router
     */
    algorithm;
    /**
     * @description 邻接链表。仅在算法为ls时使用。
     * type: [{port, neighbors}]
     * @memberof Router
     */
    adjacencyList;
    /**
     * @description 路由表。用来转发数据包。
     * @memberof Router
     */
    routeTable;

    constructor(port = -1, neighbors = [], algorithm = 'ls') {
        this.port = port;
        this.neighbors = neighbors;
        this.algorithm = algorithm;
        this.adjacencyList = [];
        this.routeTable = [];
    }

    run(params) {
        listenOn(this.port);
        setInterval(this.LSBroadcastLinkState.bind(this), 30 * 1000);
    }

    

    /**
     * Shutdown the router
     */

    shutdown(params) {
        // Stop all the timer
    }

    /**
     * Conect to a router
     * @param {String} routerName
     * @param {number} routerPort
     */

    connectRouter(routerInfo) {
        this.neighbors.push({
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

    

    LSUpdateRouteTable(LSPacket) {

    }

    LSBroadcastLinkState() {
        this.neighbors.forEach(neighbor => {
            this.sendTo(neighbor.port, {
                protocol: 'ls',
                origin: this.port,
                neighbors: this.neighbors
            });
        })
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
        socket.send(JSON.stringify(msg), destRouter, '127.0.0.1');
    }

    listenOn(port) {
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