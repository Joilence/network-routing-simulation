import * as dgram from "dgram";
import {
  Neighbor,
  RoutingTableItem,
  RoutingAlgorithm,
  Packet,
  DV,
  DVItem,
  LSLinkState
} from "./Types";
import { Address } from "cluster";
// let control = require('./control');
// let io = require('./io');
// let ls = require('./ls-route');
// let dv = require('./dv-route');

export class Router {
  /**
   * @description 路由器监听通告的端口，我们用此整数作为路由器的标志
   */
  private port: number;

  /**
   * @description 路由器的名称
   * @private
   */
  // private name: string;

  /**
   * @description 直连的路由器。
   * 算法为ls时，直接将它广播（当然，还要附带本路由器的port）
   * 当修改网络拓扑时，修改它
   * 它的更新要触发adjacencyList的更新！（如果路由器运行ls算法的话）
   * type: [{name, port, cost}]
   */
  private neighbors: Neighbor[];

  /**
   * @description 路由算法：RoutingAlgorithm.ls | dv | centralized
   */
  private algorithm: RoutingAlgorithm;

  /**
   * @description 邻接链表。仅在算法为ls时使用。
   * 使用邻接链表运行Dijkstra算法之前要将adjacencyList规范化：
   * 消除单向路径、
   * 消除无法到达本节点的节点（剩下的子图必定是连通的，因为它们都能到达本节点）、
   * 将adjacencyList转化成数组结构，以便更高效地运行Dijkstra（用下标访问取代Map.get()）
   */
  private adjacencyList: Map<number, Neighbor[]>;

  /**
   * @description 路由表。用来转发数据包。
   */
  private routeTable: Map<number, RoutingTableItem>;

  /**
   * @description Router State
   */
  private state: boolean;

  /**
   * @description max age of route entry
   */
  private routeMaxAge: number;

  /**
   * @description Interval timer for LS broadcast
   */
  private LSBroadcastTimer: number;

  /**
   * @description Interval timer for DV broadcast
   */
  private DVBroadcastTimer: number;

  /**
   * @description 每台ls路由器，需要维护下次广播的序列号
   * 详见 https://en.wikipedia.org/wiki/Link-state_routing_protocol 中的sequence number
   */
  private sequenceNumber = 0;

  /**
   * @description algorithm === 'centralized'时使用，标记本节点是不是中心路由
   */
  private isCenter: undefined | boolean;

  /**
   * @description algorithm === 'centralized'时使用，记录中心节点的地址
   */
  private centerPort: undefined | number;

  constructor(port: number,
    // name: string,
    neighbors: Neighbor[] = [],
    algorithm: RoutingAlgorithm = RoutingAlgorithm.ls,
    isCenter?: boolean,
    centerPort?: number) {
    this.port = port;
    // this.name = name;
    this.neighbors = neighbors;
    this.algorithm = algorithm;
    this.adjacencyList = new Map();
    this.routeTable = new Map();
    this.sequenceNumber = 0;
    this.isCenter = isCenter;
    this.centerPort = centerPort;
  }

  /**
   * Info Part
   * - give related information
   */
  get routerInfo() {
    return {
      // name: this.name,
      port: this.port,
    };
  }

  get logHead() {
    return `Router ${this.port} : `;
  }

  // -----------------------------Control------------------------------------
  public run() {
    if (this.state === true) {
      console.log(`${this.logHead} already running on ${this.port}`);
      return;
    }
    this.startListening();
    if (this.algorithm === RoutingAlgorithm.ls) {
      this.LSBroadcastTimer = setInterval(this.LSBroadcastLinkState.bind(this), 30 * 1000);
    } else if (this.algorithm === RoutingAlgorithm.dv) {
      this.DVBroadcastTimer = setInterval(this.DVInformNeighbors.bind(this), 30 * 1000);
    } else {
      throw new Error(`${this.logHead} unkonwn algorithm ${this.algorithm}`);
    }
    this.state = true;
  }

  public shutdown() {
    if (this.state === false) {
      console.log(`${this.logHead} already shutdown`);
      return;
    }
    clearInterval(this.LSBroadcastTimer);
    clearInterval(this.DVBroadcastTimer);
  }

  public reset() {
    if (this.state === true) {
      this.shutdown();
    }
    this.neighbors.length = 0;
    this.routeTable.clear();
    console.log(`${this.logHead} has cleared.`);
  }

  public connect(router: Router, cost: number) {
    // Add into neighbors
    this.neighbors.push({ cost: cost, port: router.port });
    // Add into route table
    this.routeTable.set(router.port, {
      dest: router.port,
      cost: cost,
      nextHop: router.port,
      timestamp: new Date()
    });
    console.log(`${this.logHead} connect with ${router.port}`);
  }

  public disconnect(router: Router) {
    const index = this.neighbors.findIndex((neighbor) => neighbor.port === router.port);
    this.neighbors.splice(index, 1);
    this.routeTable.delete(router.port);
    console.log(`${this.logHead} disconnect with ${router.port}`);
  }
  public switchTo(algorithm: RoutingAlgorithm) {
    console.log(`${this.logHead} resetting...`);
    this.reset();
    this.algorithm = algorithm;
    this.run();
    console.log(`${this.logHead} reset to ${algorithm}`);
  }

  public sendMessage(dest: number, msg: string) {
    this.sendTo(dest, {
      src: this.port,
      dest: dest,
      protocol: 'data',
      data: msg
    });
  }

  // -----------------------------IO------------------------------------
  private sendTo(dest: number, packet: Packet<any>) {
    console.log(`${this.logHead} sending ${packet} to ${dest}`);
    // Query route table
    const entry = this.routeTable.get(dest);
    let outPort = -1;
    if (entry) {
      outPort = entry.nextHop;
    } else {
      console.error(`${this.logHead} unknown router ${dest}`);
      return;
    }
    // Get out port number and send packet
    const socket = dgram.createSocket('udp4');
    socket.send(JSON.stringify(packet), outPort, '127.0.0.1');
    socket.close();
    console.log(`${this.logHead} has sent ${packet.protocol} packet to ${outPort}`);
  }

  private startListening() {
    const server = dgram.createSocket('udp4');
    server.on('listening', () => {
      const address = server.address();
      console.log(`${this.logHead} now is listening on ${address.address}:${address.port}`);
    });
    server.on('message', (msg, remoteInfo) => {
      const packet = <Packet<any>> JSON.parse(msg.toString());
      console.log(`${this.logHead} Get ${packet.protocol} packet from ${remoteInfo.address}:${remoteInfo.port}`);
      this.packetHandler(packet, remoteInfo);
    });
    server.bind(this.port);
  }

  private packetHandler(packet: Packet<any>, remoteInfo: dgram.AddressInfo) {
    if (this.neighbors.findIndex(neighbor => neighbor.port === remoteInfo.port) === -1) {
      throw new Error("从一个不是邻居的节点收到数据包");
    }
    if (packet.protocol === RoutingAlgorithm.ls) {
      //TODO: handle single-direction connection state information
      // when a router shutdown after it sends LS state
      // and its neighbors send LS state then
      // handle this single-direction connection in the first LS state
      this.LSUpdateRouteTable(packet, remoteInfo);
    } else if (packet.protocol === RoutingAlgorithm.dv) {
      this.DVUpdateRouteTable(packet, remoteInfo);
    } else if (packet.protocol === 'data') {
      if (remoteInfo.port === this.port) { // pkt to me
        console.log(`${this.logHead} receive message ${packet.data}`);
        //TODO: store received message
      } else { // pkt to forward
        this.sendTo(packet.dest, packet);
      }
    }
    else if (packet.protocol === RoutingAlgorithm.centralized) {
      if (!this.isCenter) {
        throw new Error('非中心路由接收到路由通告，可能是有路由器的“centerPort”字段配置错误');
      }
      // this.CenterUpdateRouteTable()
    }
  }

  // -----------------------------dv------------------------------------
  /**
   * @description dv算法只用将**自己的距离向量**发给**邻居**，不需要广播
   */
  private DVInformNeighbors() {
    console.log(`${this.logHead} + start DV broadcast`);
    this.neighbors.forEach(neighbor => {
      this.sendTo(neighbor.port, {
        src: this.port,
        dest: neighbor.port,
        protocol: RoutingAlgorithm.dv,
        data: this.generateDV(neighbor.port)
      });
      console.log(`${this.logHead} send to ${neighbor.port}`);
    });
  }

  private DVUpdateRouteTable(packet: Packet<DV>, remoteInfo: dgram.AddressInfo) {
    const routeOfOrigin = this.routeTable.get(remoteInfo.port);
    if (routeOfOrigin === undefined) {
      throw new Error("routeTable中没有发送者的信息");
    }

    console.log(`${this.logHead} update route table via DV packet from ${remoteInfo.port}`);

    packet.data.forEach(dvItem => {
      const routeOfDest = this.routeTable.get(dvItem.dest);
      if (routeOfDest === undefined) {
        // No corresponding entry found, and add new entry
        this.routeTable.set(dvItem.dest, {
          dest: dvItem.dest,
          cost: dvItem.cost + routeOfOrigin.cost,
          nextHop: remoteInfo.port,
          timestamp: new Date()
        });
      } else if (routeOfDest.cost > routeOfOrigin.cost + dvItem.cost) {
        // Found entry with higher cost, and update it
        routeOfDest.cost = routeOfOrigin.cost + dvItem.cost;
        routeOfDest.nextHop = remoteInfo.port;
        routeOfDest.timestamp = new Date();
      }
    });
  }

  private generateDV(dest: number) {
    const dv: DV = [];
    this.routeTable.forEach(routinTableItem => {
      if (routinTableItem.nextHop !== dest) {
        dv.push({
          dest: routinTableItem.dest,
          cost: routinTableItem.cost
        });
      }
    });
    return dv;
  }

  // -----------------------------ls------------------------------------
  /**
   * @description 将LSLinkState广播到网络中的所有主机
   */
  private LSBroadcastLinkState() {
    const linkState: LSLinkState = {
      origin: this.port,
      neighbors: this.neighbors,
      sequenceNumber: this.sequenceNumber++
    };
    this.neighbors.forEach(neighbor => {
      this.sendTo(neighbor.port, {
        src: this.port,
        dest: neighbor.port,
        protocol: RoutingAlgorithm.ls,
        data: linkState
      });
    });
  }

  private LSUpdateRouteTable(packet: Packet<LSLinkState>, remoteInfo: dgram.AddressInfo) {
    // 更新adjacencyList
    this.adjacencyList.set(packet.data.origin, packet.data.neighbors);
    this.runDijkstra();
  }

  private runDijkstra() {
    // 初始化currentDist
    const currentDist = new Map();
    this.adjacencyList.forEach((neighbors, port) => {
      // currentDist的字段，它存储了Dijkstra算法需要的信息
      currentDist.set(port, {
        port: port,
        cost: Number.MAX_SAFE_INTEGER,
        hasExpanded: false,
        nextHop: -1 // 下一跳的路由
      });
    });
    const originDistInfo = currentDist.get(this.port);
    originDistInfo.cost = 0;
    originDistInfo.nextHop = this.port;

    // 不断扩展节点，更新currentDist
    for (let i = 0; i < this.adjacencyList.size; i++) {
      // 找到下一个要扩展的节点（也就是尚未扩展，但是距离原点距离最短的那个节点）
      let expandingRouter = -1,
        minCost = -1;
      currentDist.forEach((distInfo, port) => {
        if (distInfo.cost !== Number.MAX_SAFE_INTEGER &&
          Number.isSafeInteger(distInfo.cost) &&
          distInfo.cost < minCost &&
          !distInfo.hasExpanded) {
          expandingRouter = port;
          minCost = distInfo.cost;
        }
      });
      if (expandingRouter == -1 || minCost == -1) throw new Error('没有找到可扩展的节点，网络不连通');

      // 扩展expandingRouter
      const expandingDistInfo = currentDist.get(expandingRouter);
      expandingDistInfo.hasExpanded = true;

      const neighbors = this.adjacencyList.get(expandingRouter);
      neighbors.forEach((neighbor) => {
        const neighborDistInfo = currentDist.get(neighbor.port);
        if (neighborDistInfo.cost > expandingDistInfo.cost + neighbor.cost) {
          // neighbor与原点的距离 > expandingRouter与原点的距离 + expandingRouter与neighbor的距离
          neighborDistInfo.cost = expandingDistInfo.cost + neighbor.cost;
          neighborDistInfo.nextHop = expandingRouter.nextHop;
        }
      });
    }

    // 使用currentDist更新路由表
    // TODO: 哪些路由表项的timestamp需要更新
    currentDist.forEach((distInfo, port) => {
      let originalRouteItem = this.routeTable.get(port);
      if (originalRouteItem === undefined ||
        originalRouteItem.cost !== distInfo.cost ||
        originalRouteItem.toPort !== distInfo.nextHop) {
        // 如果路由表还没有去往该目标路由器的条目，或条目的cost与计算结果不同，或条目的nextHop与计算结果不同
        // 更新该表项
        this.routeTable.set(port, {
          dest: port,
          cost: distInfo.cost,
          toPort: distInfo.nextHop,
          timestamp: new Date()
        });
      }
    });

  }
}

// Router.prototype = Object.create(Router.prototype, control, io, ls, dv);
