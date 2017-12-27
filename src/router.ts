import * as dgram from "dgram";
import {
  Neighbor,
  Neighbors,
  RouteTableItem,
  RouteTable,
  RoutingAlgorithm,
  Packet,
  DVItem,
  DV,
  LSLinkState,
  RouterState
} from "./Types";

export class Router {
  /**
   * @description 路由器监听通告的端口，我们用此整数作为路由器的标识符
   */
  private port: number;

  /**
   * @description 路由器的名称
   * @private
   */
  // private name: string;

  /**
   * @description 存储所有邻居的信息。
   * 它是Router了解当前网络状态的根本途径，它的更新要触发ls算法或dv算法的执行。
   * adjacencyList、DV的更新从根本上来说都来自于它的更新。
   * 详见 https://www.processon.com/diagraming/5a410028e4b0bf89b85a6c15
   * 算法为ls时，直接将它广播
   * 算法为dv时，在计算自己dv的时候需要用到它
   * 当修改网络拓扑时，修改它，网络拓扑的变化信息就能扩散到整个网络
   */
  private neighbors: Neighbors;

  /**
   * @description 路由算法：RoutingAlgorithm.ls | dv | centralized
   */
  private algorithm: RoutingAlgorithm;

  /**
   * @description 邻接链表。仅在算法为ls时使用。
   * 使用邻接链表运行Dijkstra算法之前要将adjacencyList规范化：
   * 消除单向路径、
   * 将Map转化成Array，将每个邻居用它在数组中的下标来表示，从而能Dijkstra算法能更快地找到对应邻居（用下标访问取代Map.get()）
   * Dijkstra算法的输出只包括从本节点可达的节点，利用这一点，将adjacencyList中已经不可达的节点删除
   */
  private adjacencyList: Map<number, Neighbors>;

  /**
   * @description 存储邻居的DV。仅在算法为dv时使用。
   * @private
   * @type {Map<number, DV>}
   */
  private neighborsDVs: Map<number, DV>;

  /**
   * @description 路由表。用来转发数据包。
   * 它是ls或dv的计算结果，不要直接修改routeTable，而是修改数据来源（也就是neighbors）
   * 道理类似于：我们不应该直接修改编译器的输出代码，而应该去修改编译器的输入代码，从而输出会相应地改变
   */
  private routeTable: RouteTable;

  /**
   * @description Router State
   */
  private state: RouterState;

  // 在关闭路由器的时候要调用stopListening()，释放套接字
  private stopListening: null | (() => void) = null;

  /**
   * @description 每台ls路由器，需要维护下次广播的序列号
   * 如果路由器多次收到来自同一台路由器且序号相同的广播，则不作出任何反应，防止广播风暴
   * 否则，接受这个路由广播，更新adjacencyList，并向所有邻居转发这个广播
   * 详见 https://en.wikipedia.org/wiki/Link-state_routing_protocol 中的sequence number
   */
  private sequenceNumber = 0;

  /**
   * @description algorithm === 'centralized'时使用，标记本节点是不是中心路由
   */
  private isCenter: boolean;

  /**
   * @description algorithm === 'centralized'时使用，记录中心节点的地址
   */
  private centerPort: number;

  constructor(port: number,
    // name: string,
    neighbors: Neighbors = new Map(),
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
    this.isCenter = !!isCenter;
    this.centerPort = Number(centerPort);
  }

  /**
   * @description 获取本路由器的汇总信息，方便交给UI显示
   * @readonly
   */
  get routerInfo() {
    return {
      // name: this.name,
      port: this.port,
      algorithm: this.algorithm,
      state: this.state,
      neighbors: this.neighbors,
      adjacencyList: Array.from(this.adjacencyList),  // 转化为可JSON化的对象
      routeTable: Array.from(this.routeTable)         // 转化为可JSON化的对象
    };
  }

  get logHead() {
    return `Router ${this.port} : `;
  }

  // -----------------------------Control------------------------------------
  public run() {
    if (this.state !== RouterState.off) {
      throw new Error(`${this.logHead} is already running on ${this.port} or has fail`);
    }
    this.startListening();
    this.state = RouterState.on;
    // 清空所有有关网络状态的信息，不包括neighbors
    this.clearNetworkInfoStorage();
    // 清空网络状态存储以后，要调用这个方法来更新adjacencyList或neighborsDVs
    this.respondToNeighborsChange(this.neighbors);
  }

  /**
   * @description 路由器正常关机，相当于断开这个路由器的所有链路
   * neighbors、adjacencyList、routeTable被清除
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * 用RouterController来修改网络信息，从而保证链路双方的路由器配置都被修改
   */
  public shutdown() {
    if (this.state !== RouterState.on) {
      throw new Error(`${this.logHead} has already been shutdown or fail`);
    }
    if (typeof this.stopListening !== 'function') {
      throw new Error(`${this.logHead} stopListening is null`);
    }
    this.stopListening();
    this.stopListening = null;
    this.state = RouterState.off;
    // 不清空neighbors，以便在开启的时候，RouterController能够用它恢复原来的连线
    this.clearNetworkInfoStorage();
  }

  /**
   * @description 重置路由器。清空所有有关网络状态的信息。
   * 不会清空neighbors，因为neighbors代表物理链路（网络拓扑）
   * 改变网络拓扑不是router自己能够做到的，应该由RouterController来做。
   */
  private clearNetworkInfoStorage() {
    this.adjacencyList.clear();
    this.neighborsDVs.clear();
    this.routeTable.clear();
  }

  /**
   * @description 增加neighbors表并触发路由算法
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * @param {number} port
   * @param {number} cost
   */
  public connect(port: number, cost: number) {
    const neighborAlready = this.neighbors.get(port);
    if (neighborAlready === undefined) {
      console.warn(`${this.logHead} 路由器${port}已经是邻居，connect操作取消`);
      return;
    }
    // Add into neighbors
    this.neighbors.set(port, { cost: cost, dest: port });
    this.respondToNeighborsChange(this.neighbors);
    console.log(`${this.logHead} connect with ${port}`);
  }

  /**
   * @description 减少neighbors表并触发路由算法
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * @param {number} port
   */
  public disconnect(port: number) {
    if (!this.neighbors.delete(port)) {
      console.warn(`${this.logHead} 路由器${port}不是邻居，disconnect操作取消`);
      return;
    }
    this.respondToNeighborsChange(this.neighbors);
    console.log(`${this.logHead} disconnect with ${port}`);
  }

  /**
   * @description 切换路由算法。
   * 在其他路由器为ls算法的情况下，将一个路由器配置为dv算法没有什么意义
   * 应该由RouterController同时修改所有路由器的算法
   * @param {RoutingAlgorithm} algorithm
   */
  public switchAlgorithm(algorithm: RoutingAlgorithm) {
    this.clearNetworkInfoStorage();
    this.algorithm = algorithm;
    if (this.state === RouterState.on) {
      // 改变路由算法以后，要调用这个方法来更新adjacencyList或neighborsDVs
      this.respondToNeighborsChange(this.neighbors);
    }
    console.log(`${this.logHead} reset to ${algorithm}`);
  }

  public sendMessage(dest: number, msg: string) {
    this.sendPacket(dest, {
      src: this.port,
      dest: dest,
      protocol: 'data',
      data: msg
    });
  }

  /**
   * @description 这个方法封装了Router为了响应网络状态(neighbors)的变化，而进行的一系列操作：
   * 更新adjacencyList或neighborsDVs（取决于路由算法）
   * 运行路由算法
   * 根据路由算法的输出来更新路由表和adjacencyList
   * 如果新的DV与之前的不同，则通告给邻居
   * @private
   * @param {Neighbors} neighbors 更新后的neighbors
   */
  private respondToNeighborsChange(neighbors: Neighbors) {
    if (this.algorithm === RoutingAlgorithm.ls) {
      this.LSUpdateAdjacencyListWithNeighbors(this.neighbors);
    }
    else if (this.algorithm === RoutingAlgorithm.dv) {
      this.DVUpdateNeighborsDVsWithNeighbors(this.neighbors);
    }
  }

  // -----------------------------IO------------------------------------
  private sendPacket(dest: number, packet: Packet<any>) {
    console.log(`${this.logHead} sending ${packet} to ${dest}`);
    // Query route table
    const entry = this.routeTable.get(dest);
    let outPort = -1;
    if (entry !== undefined) {
      outPort = entry.nextHop;
    } else {
      console.error(`${this.logHead} unknown router ${dest}`);
      return;
    }
    // Get out port number and send packet
    const socket = dgram.createSocket('udp4');
    socket.send(JSON.stringify(packet), outPort, '127.0.0.1', (err) => {
      if (err) {
        console.error(`${this.logHead} fail to send packet to ${outPort}`, err);
      } else {
        console.log(`${this.logHead} has sent ${packet.protocol} packet to ${outPort}`);
      }
      socket.close();
    });
  }

  private startListening() {
    if (this.stopListening != null) {
      throw new Error(`${this.logHead} you shouldn't startListening before closing last socket`);
    }
    const server = dgram.createSocket('udp4');
    server.on('listening', () => {
      const address = server.address();
      console.log(`${this.logHead} now is listening on ${address.address}:${address.port}`);
    });
    server.on('error', (err) => {
      server.close();
      throw new Error(`服务器异常：\n${err.stack}`);
    });
    server.on('message', (msg, remoteInfo) => {
      const packet = <Packet<any>> JSON.parse(msg.toString());
      console.log(`${this.logHead} Get ${packet.protocol} packet from ${remoteInfo.address}:${remoteInfo.port},
      src is ${packet.src}`);
      this.packetHandler(packet, remoteInfo);
    });
    server.bind(this.port);
    // 在关闭路由器的时候要调用stopListening()，释放套接字
    this.stopListening = () => {
      server.close();
    };
  }

  private packetHandler(packet: Packet<any>, remoteInfo: dgram.AddressInfo) {
    if (this.neighbors.get(remoteInfo.port) === undefined) {
      throw new Error("从一个不是邻居的节点收到数据包");
    }
    if (packet.protocol === RoutingAlgorithm.ls) {
      // TODO: handle single-direction connection state information
      // when a router shutdown after it sends LS state
      // and its neighbors send LS state then
      // handle this single-direction connection in the first LS state

      // TODO: 广播数据包。为了防止洪范，要在这里丢弃接收过的数据包而不响应

      this.LSUpdateAdjacencyListWithReceivedLS(packet.src, packet.data);
    } else if (packet.protocol === RoutingAlgorithm.dv) {
      this.DVUpdateNeighborsDVsWithReceivedDV(packet.src, packet.data);
    } else if (packet.protocol === 'data') {
      if (packet.dest === this.port) { // pkt to me
        console.log(`${this.logHead} receive message ${packet.data}`);
        // TODO: store received message
      } else { // pkt to forward
        this.sendPacket(packet.dest, packet);
      }
    }
    else if (packet.protocol === RoutingAlgorithm.centralized) {
      if (!this.isCenter) {
        throw new Error('非中心路由接收到路由通告，可能是有路由器的“centerPort”字段配置错误');
      }
      // TODO: 中心路由算法
      // this.CenterUpdateRouteTable()
    }
  }

  // -----------------------------dv------------------------------------
  /**
   * @description dv算法只用将**自己的距离向量**发给**邻居**，不需要广播
   */
  private DVInformNeighbors(dv: RouteTable) {
    console.log(`${this.logHead} + start DV broadcast`);
    this.neighbors.forEach(neighbor => {
      this.sendPacket(neighbor.dest, {
        src: this.port,
        dest: neighbor.dest,
        protocol: RoutingAlgorithm.dv,
        data: this.generateDV(neighbor.dest, this.routeTable)
      });
    });
  }

  private generateDV(dest: number, routeTable: RouteTable) {
    const dv: DVItem[] = [];
    routeTable.forEach(routinTableItem => {
      if (routinTableItem.nextHop !== dest) {
        dv.push({
          dest: routinTableItem.dest,
          cost: routinTableItem.cost
        });
      }
    });
    return dv;
  }

  /**
   * @description 根据neighbors来更新neighborsDVs
   * @private
   * @param {Neighbors} neighbors
   */
  private DVUpdateNeighborsDVsWithNeighbors(neighbors: Neighbors): void {

    this.respondToNeighborsDVsChange(neighbors, this.neighborsDVs);
  }

  /**
   * @description 根据接收到的dv通告来更新neighborsDVs
   * @private
   */
  private DVUpdateNeighborsDVsWithReceivedDV(origin: number, dv: DV): void {

    this.respondToNeighborsDVsChange(this.neighbors, this.neighborsDVs);
  }

  private respondToNeighborsDVsChange(neighbors: Neighbors, neighborsDVs: Map<number, DV>) {
    if (this.algorithm !== RoutingAlgorithm.dv) {
      throw new Error("方法调用错了！");
    }
    const newRouteTable = this.DVComputeRouteTable(neighbors, neighborsDVs);
    if (this.DVhasChanged(this.routeTable, newRouteTable)) {
      // 如果新的路由表与之前的路由表相比有发生变化，才发送DV通告
      this.routeTable = newRouteTable;
      this.DVInformNeighbors(newRouteTable);
    }
  }

  /**
   * @description 工具函数，新的路由表（自己的DV）与之前的路由表相比，有没有发生变化
   * @private
   * @param {RouteTable} oldRouteTable
   * @param {RouteTable} newRouteTable
   */
  private DVhasChanged(oldRouteTable: RouteTable, newRouteTable: RouteTable): boolean {

  }

  /**
   * @description DV算法的实现。
   * @private
   * @param {Neighbors} neighbors
   * @param {Map<number, DV>} neighborsDVs
   */
  private DVComputeRouteTable(neighbors: Neighbors, neighborsDVs: Map<number, DV>): RouteTable {

  }

  // -----------------------------ls------------------------------------
  /**
   * @description 将LSLinkState广播到网络中的所有主机
   */
  private LSBroadcastLinkState(neighbors: Neighbors) {
    // neighbors被转化为数组以后才能被序列化
    const neighborsArray: Neighbor[] = [];
    this.neighbors.forEach(neighbor => {
      neighborsArray.push(neighbor);
    });

    const linkState: LSLinkState = {
      neighbors: neighborsArray,
      sequenceNumber: this.sequenceNumber++
    };
    this.neighbors.forEach(neighbor => {
      this.sendPacket(neighbor.dest, {
        src: this.port,
        dest: neighbor.dest,
        protocol: RoutingAlgorithm.ls,
        data: linkState
      });
    });
  }

  /**
   * @description 根据neighbors来更新AdjacencyList。
   * 算法：
   * 1. 检查自己的邻居链表，删掉没出现在neighbors中的节点。
   * 2. 检查其他每个节点i的邻居链表，如果i不在neighbors中，则它的邻居链表中不能有本节点（如果有，则删掉）；
   * 如果i在neighbors中，则它的邻居链表中必须有本节点（如果没有，则加上）。
   * @private
   * @param {Neighbors} neighbors
   */
  private LSUpdateAdjacencyListWithNeighbors(neighbors: Neighbors) {

    this.respondToAdjacencyListChange(neighbors, this.adjacencyList);
  }

  /**
   * @description 根据最新计算出的路由表来更新AdjacencyList。
   * 算法：
   * 对于不在路由表中的节点，说明它们已经不可达，应该删除它们对应的邻居链表
   * @private
   * @param {RouteTable} routeTable
   */
  private LSUpdateAdjacencyListWithRouteTable(routeTable: RouteTable) {

  }

  /**
   * @description 根据接收到的LS广播来更新AdjacencyList。
   * 算法：
   * 如果origin的邻居链表已经在AdjacencyList中，将邻居链表替换为广播中的邻居链表；
   * 如果origin的邻居链表不在AdjacencyList中，向AdjacencyList增加广播中的邻居链表。
   * @private
   */
  private LSUpdateAdjacencyListWithReceivedLS(origin: number, neighbors: Neighbors) {
    // TODO: 如果接收到的ls与邻接链表中的相同，则不触发更新

  }

  /*
  private LSUpdateRouteTable(packet: Packet<LSLinkState>, remoteInfo: dgram.AddressInfo) {
    // 更新adjacencyList
    this.adjacencyList.set(packet.data.origin, packet.data.neighbors);
    this.runDijkstra();
  }
  */

  private respondToAdjacencyListChange(neighbors: Neighbors, adjacencyList: Map<number, Neighbors>) {
    if (this.algorithm !== RoutingAlgorithm.ls) {
      throw new Error("方法调用错了！");
    }
    const newRouteTable = this.LSRunDijkstra(adjacencyList); // TODO: 更新runDijkstra
    this.routeTable = newRouteTable;
    // 从AdjacencyList中删除那些已经无法到达的节点
    this.LSUpdateAdjacencyListWithRouteTable(newRouteTable);
    this.LSBroadcastLinkState(neighbors);
  }

  private LSRunDijkstra(adjacencyList: Map<number, Neighbors>): RouteTable {
    // 初始化currentDist
    const currentDist: Map<number, { cost: number, hasExpanded: boolean, nextHop: number }> = new Map();
    this.adjacencyList.forEach((neighbors, port) => {
      // currentDist的字段，它存储了Dijkstra算法需要的信息
      currentDist.set(port, {
        cost: Number.MAX_SAFE_INTEGER + 1,
        hasExpanded: false,
        nextHop: -1 // 下一跳的路由
      });
    });
    const originDistInfo = currentDist.get(this.port);
    if (originDistInfo === undefined) {
      throw new Error("adjacencyList中没有自己的条目");
    }
    originDistInfo.cost = 0;
    originDistInfo.nextHop = this.port;

    // 不断扩展节点，更新currentDist
    for (let i = 0; i < this.adjacencyList.size; i++) {
      // 找到下一个要扩展的节点（也就是尚未扩展，但是距离原点距离最短的那个节点）
      let expandingRouter = -1;
      let minCost = -1;
      currentDist.forEach((distInfo, port) => {
        if (distInfo.cost !== Number.MAX_SAFE_INTEGER &&
          Number.isSafeInteger(distInfo.cost) &&
          distInfo.cost < minCost &&
          !distInfo.hasExpanded) {
          expandingRouter = port;
          minCost = distInfo.cost;
        }
      });
      if (expandingRouter === -1 || minCost === -1) { throw new Error('没有找到可扩展的节点，网络不连通'); }

      // 扩展expandingRouter
      const expandingDistInfo = currentDist.get(expandingRouter);
      if (expandingDistInfo === undefined) { throw new Error("currentDist中没有expandingRouter"); }
      expandingDistInfo.hasExpanded = true;

      const neighbors = this.adjacencyList.get(expandingRouter) as Neighbors;
      neighbors.forEach((neighbor) => {
        const neighborDistInfo = currentDist.get(neighbor.dest);
        if (neighborDistInfo === undefined) { throw new Error("currentDist中没有expandingRouter的neighbor"); }
        if (neighborDistInfo.cost > expandingDistInfo.cost + neighbor.cost) {
          // neighbor与原点的距离 > expandingRouter与原点的距离 + expandingRouter与neighbor的距离
          neighborDistInfo.cost = expandingDistInfo.cost + neighbor.cost;
          neighborDistInfo.nextHop = expandingDistInfo.nextHop;
        }
      });
    }

    // 使用currentDist更新路由表
    // TODO: 哪些路由表项的timestamp需要更新
    currentDist.forEach((distInfo, port) => {
      const originalRouteItem = this.routeTable.get(port);
      if (originalRouteItem === undefined ||
        originalRouteItem.cost !== distInfo.cost ||
        originalRouteItem.nextHop !== distInfo.nextHop) {
        // 如果路由表还没有去往该目标路由器的条目，或条目的cost与计算结果不同，或条目的nextHop与计算结果不同
        // 更新该表项
        this.routeTable.set(port, {
          dest: port,
          cost: distInfo.cost,
          nextHop: distInfo.nextHop
        });
      }
    });

  }
}
