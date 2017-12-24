import {
    setInterval
} from 'timers';

var dgram = require('dgram');
var control = require('./control');
var io = require('./io');
var ls = require('./ls-route');
var dv = require('./dv-route');

class Router {
    /**
     * @description 路由器监听通告的端口，我们用此整数作为路由器的标志
     * @type {number}
     * @memberof Router
     */
    port;

    /**
     * @description 直连的路由器。
     * 算法为ls时，直接将它广播（当然，还要附带本路由器的port）
     * @type {[{name, port, cost}]}
     * @memberof Router
     */
    neighbours;

    /**
     * @description 路由算法：'ls' | 'dv'
     * @type {String}
     * @memberof Router
     */
    algorithm;

    /**
     * @description 邻接链表。仅在算法为ls时使用。
     * @type {Map<port, {neighbors}>}
     * @memberof Router
     */
    adjacencyList;

    /**
     * @description 路由表。用来转发数据包。
     * @type {Map<port, {}>}
     * @memberof Router
     */
    routeTable;

    /**
     * @description Router State
     * @type {Bool}
     * @memberof Router
     */
    state;

    /**
     * @description max age of route entry
     * @type {number}
     * @memberof Router
     */
    routeMaxAge;

    /**
     * @description Interval timer for LS broadcast
     * @type {Timeout}
     * @memberof Router
     */
    LSBroadcostTimer;

    /**
     * @description Interval timer for DV broadcast
     * @type {Timeout}
     * @memberof Router
     */
    DVBroadcostTimer;

    constructor(port = -1, neighbors = [], algorithm = 'ls') {
        this.port = port;
        this.neighbors = neighbors;
        this.algorithm = algorithm;
        this.adjacencyList = new Map();
        this.routeTable = new Map();
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

    get logHead() {
        return `${this.name} : ${this.port} - `;
    }
}

Router.prototype = Object.create(Router.prototype, control, io, ls, dv);