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
  public port: number;

  private UDPSocket: dgram.Socket | undefined;

  /**
   * @description 存储所有邻居的信息。
   * 它是Router了解当前网络状态的根本途径，它的更新要触发ls算法或dv算法的执行。
   * adjacencyList、DV的更新从根本上来说都来自于它的更新。
   * 详见 https://www.processon.com/diagraming/5a410028e4b0bf89b85a6c15
   * 算法为ls时，将它广播到整个网络
   * 算法为dv时，在计算自己dv的时候需要用到它
   * 当修改网络拓扑时，修改它，网络拓扑的变化信息就能扩散到整个网络
   */
  private neighbors: Neighbors = new Map();
  public getNeighbors() {
    const res: Neighbor[] = [];
    this.neighbors.forEach((neighbor) => {
      res.push({ ...neighbor });
    });
    return res;
  }

  /**
   * @description 路由算法：RoutingAlgorithm.ls | dv | centralized
   */
  private algorithm: RoutingAlgorithm = RoutingAlgorithm.ls;

  /**
   * @description 邻接链表。仅在算法为ls时使用。
   * 使用邻接链表运行Dijkstra算法时，要忽略那些单向的链路（也就是说，如果A的邻居中有B，但B的邻居中没有A，那么不算这条链路）。
   * Dijkstra算法的输出只包括从本节点可达的节点，利用这一点，可以将adjacencyList中已经不可达的节点删除
   */
  private adjacencyList: Map<number, Neighbors> = new Map();

  /**
   * @description 存储邻居的DV。仅在算法为dv时使用。
   * @private
   * @type {Map<number, DV>}
   */
  private neighborsDVs: Map<number, DV> = new Map();

  /**
   * @description 路由表。用来转发数据包。
   * 它是ls或dv的计算结果，不要直接修改routeTable，而是修改数据来源（也就是neighbors）
   * 道理类似于：我们不应该直接修改编译器的输出代码，而应该去修改编译器的输入代码，从而输出会相应地改变
   * TODO: 确保路由表中有去往自己的条目，否则在dv计算中会出问题，而且在LSUpdateAdjacencyListWithRouteTable中也会误删自己的邻居表
   */
  private routeTable: RouteTable = new Map();

  /**
   * @description Router State
   */
  private state: RouterState = RouterState.off;

  /**
   * @description 每台ls路由器，需要维护下次要广播的序列号
   * 如果路由器多次收到来自同一台路由器且序号相同的广播，则不作出任何反应，防止广播风暴
   * 否则，接受这个路由广播，更新adjacencyList，并向所有邻居转发这个广播
   * 详见 https://en.wikipedia.org/wiki/Link-state_routing_protocol 中的sequence number
   */
  private NextLSSequenceNumber = 0;
  /**
   * @description 对于其他的每个节点，记录上次收到来自它的LS广播的序列号
   * 如果路由器多次收到来自同一台路由器且序号相同的广播，则不作出任何反应，防止广播风暴
   * @private
   * @type {Map<number, number>}
   */
  private receivedLSSequenceNumber: Map<number, number> = new Map();

  private timerIds: { LSBroadcast: any; neighborsMonitoring: any; } = {
    LSBroadcast: undefined,
    neighborsMonitoring: null
  };

  /**
   * @description algorithm === 'centralized'时使用，标记本节点是不是中心路由
   */
  private isCenter: boolean = false;

  /**
   * @description algorithm === 'centralized'时使用，记录中心节点的地址
   */
  private centerPort: number = -1;

  private pushLog: (msg: string, json?: any) => void;

  constructor(port: number,
    logFunc: (msg: string, json?: any) => void,
    algorithm: RoutingAlgorithm = RoutingAlgorithm.ls,
    isCenter?: boolean,
    centerPort?: number) {
    this.port = port;
    this.pushLog = logFunc;
    this.algorithm = algorithm;
    this.isCenter = !!isCenter;
    this.centerPort = Number(centerPort);
  }

  /**
   * @description 获取本路由器的汇总信息，方便交给UI显示
   * @readonly
   */
  public getRouterInfo() {
    return {
      port: this.port,
      algorithm: this.algorithm,
      neighbors: this.stringifiableNeighbors(this.neighbors),
      state: this.state,
      adjacencyList: this.stringifiableAdjacencyList(this.adjacencyList),
      neighborsDVs: this.stringifiableNeighborsDVs(this.neighborsDVs),
      routeTable: this.stringifiableRouteTable(this.routeTable)
    };
  }

  public stringifiableNeighbors(neighbors: Neighbors) {
    const res: any = {};
    neighbors.forEach((neighbor, port) => {
      res[port] = neighbor;
    });
    return res;
  }

  public stringifiableAdjacencyList(adjacencyList: Map<number, Neighbors>) {
    const res: any = {};
    adjacencyList.forEach((neighbors, originPort) => {
      const neighborsObj: any = res[originPort] = {};
      neighbors.forEach((neighbor, neighborPort) => {
        neighborsObj[neighborPort] = neighbor;
      });
    });
    return res;
  }

  public stringifiableNeighborsDVs(neighborsDVs: Map<number, DV>) {
    const res: any = {};
    neighborsDVs.forEach((dv, neighborPort) => {
      const DVObj: any = res[neighborPort] = {};
      dv.forEach((dvItem, dest) => {
        DVObj[dest] = dvItem;
      });
    });
    return res;
  }

  public stringifiableRouteTable(routeTable: RouteTable) {
    const res: any = {};
    routeTable.forEach((routeTableItem, dest) => {
      res[dest] = routeTableItem;
    });
    return res;
  }

  get logHead() {
    return `Router ${this.port} : `;
  }

  // -----------------------------Control------------------------------------
  public run() {
    if (this.state !== RouterState.off || this.UDPSocket != null) {
      throw new Error(`${this.logHead} is already running on ${this.port} or has fail`);
    }
    this.startListening();
    this.state = RouterState.on;
    this.pushLog(`start running`);
    // 清空所有有关网络状态的信息，不包括neighbors
    this.clearNetworkInfoStorage();
    // 清空网络状态存储以后，要调用这个方法来更新adjacencyList或neighborsDVs
    this.respondToNeighborsChange(this.neighbors);
    this.startTimer();
  }

  /**
   * @description 路由器正常关机，相当于断开这个路由器的所有链路
   * neighbors、adjacencyList、routeTable被清除
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * 用RouterController来修改网络信息，从而保证链路双方的路由器配置都被修改
   */
  public shutdown() {
    if (this.state !== RouterState.on || this.UDPSocket == null) {
      console.warn(`${this.logHead} has already been shutdown or fail`);
      return;
    }
    this.UDPSocket.close();
    this.UDPSocket = undefined;
    this.state = RouterState.off;
    // 不清空neighbors，以便在开启的时候，RouterController能够用它恢复原来的连线
    this.clearNetworkInfoStorage();
    this.pushLog(`shutdown`);
    this.stopTimer();
  }

  /**
   * @description 将此路由器设置为出错状态，与邻居仍然相连，但是已经无法收发任何数据包
   * @memberof Router
   */
  public fail() {
    if (this.state !== RouterState.on || this.UDPSocket == null) {
      throw new Error(`${this.logHead} has already been shutdown or fail`);
    }
    this.state = RouterState.fault;
    this.stopTimer();
    this.pushLog(`router break down`);
  }

  /**
   * @description 将路由器从出错状态恢复到正常状态
   * @memberof Router
   */
  public recover() {
    if (this.state !== RouterState.fault || this.UDPSocket == null) {
      throw new Error(`${this.logHead} recover()只在RouterState.fault时可以调用`);
    }
    this.state = RouterState.on;
    this.pushLog(`router recover`);
    this.startTimer();
  }

  /**
   * @description 增加neighbors表并触发路由算法
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * @param {number} port
   * @param {number} cost
   */
  public connect(port: number, cost: number) {
    const neighborAlready = this.neighbors.get(port);
    if (neighborAlready !== undefined) {
      console.warn(`${this.logHead} 路由器${port}已经是邻居，connect操作取消`);
      return;
    }
    // Add into neighbors
    this.neighbors.set(port, { cost: cost, dest: port });
    this.pushLog(`connect with ${port}`);
    this.respondToNeighborsChange(this.neighbors);
  }

  /**
   * @description 减少neighbors表并触发路由算法
   * 不要手动调用！此方法只会修改**本路由器**的配置
   * @param {number} port
   */
  public disconnect(port: number) {
    if (!this.neighbors.delete(port)) {
      console.warn(`${this.logHead} 路由器${port}不是邻居，disconnect操作无效`);
      return;
    }
    this.pushLog(`disconnect with ${port}`);
    this.respondToNeighborsChange(this.neighbors);
  }

  /**
   * @description 只会修改本路由器中的信息
   * @param {number} neighbor
   * @param {number} LinkCost
   */
  public changeLinkCost(neighborPort: number, LinkCost: number) {
    const neighbor = this.neighbors.get(neighborPort);
    if (neighbor === undefined) { throw new Error(`${this.logHead} changeLinkCost传入的参数不是邻居`); }
    this.pushLog(`changing link cost with ${neighborPort}: from ${neighbor.cost} to ${LinkCost}`);
    neighbor.cost = LinkCost;
    this.respondToNeighborsChange(this.neighbors);
  }

  /**
   * @description 切换路由算法。
   * 在其他路由器为ls算法的情况下，将一个路由器配置为dv算法没有什么意义
   * 应该由RouterController同时修改所有路由器的算法
   * @param {RoutingAlgorithm} algorithm
   */
  /*
  public switchAlgorithm(algorithm: RoutingAlgorithm) {
    this.clearNetworkInfoStorage();
    this.algorithm = algorithm;
    if (this.state === RouterState.on) {
      // 改变路由算法以后，要调用这个方法来更新adjacencyList或neighborsDVs
      this.respondToNeighborsChange(this.neighbors);
    }
    console.log(`${this.logHead} reset to ${algorithm}`);
  }
  */

  public sendMessage(dest: number, msg: string) {
    this.pushLog(`sending message "${msg}" to ${dest}`);
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
      this.LSBroadcastLinkState(neighbors);
    }
    else if (this.algorithm === RoutingAlgorithm.dv) {
      this.DVUpdateNeighborsDVsWithNeighbors(this.neighbors);
    }
  }

  /**
   * @description 重置路由器。清空所有有关网络状态的信息。
   * 不会清空neighbors，因为neighbors代表物理链路（网络拓扑）
   * 改变网络拓扑不是router自己能够做到的，应该由RouterController来做。
   */
  private clearNetworkInfoStorage() {
    this.receivedLSSequenceNumber.clear();
    this.adjacencyList.clear();
    this.neighborsDVs.clear();
    this.routeTable.clear();
  }

  // -----------------------------IO------------------------------------
  private sendPacket(dest: number, packet: Packet<any>) {
    if (this.state !== RouterState.on || this.UDPSocket == null) {
      // 如果路由器没有在正常运行，或UDPSocket还没有创建，则不发包
      console.warn(`${this.logHead} 路由器尝试在${this.state}状态下发包，没有成功发出`);
      return;
    }
    // Query route table
    const entry = this.routeTable.get(dest);
    let outPort = -1;
    if (entry !== undefined) {
      outPort = entry.nextHop;
    } else {
      console.warn(`${this.logHead} sendPacket unknown router ${dest}`);
      return;
    }
    // Get out port number and send packet
    this.UDPSocket.send(JSON.stringify(packet), outPort, '127.0.0.1', (err) => {
      if (err) {
        console.error(`${this.logHead} fail to send packet to ${outPort}`, err);
      } else {
        // console.log(`${this.logHead} has sent ${packet.protocol} packet to ${outPort}`);
      }
    });
  }

  private startListening() {
    if (this.UDPSocket != null || this.state !== RouterState.off) {
      throw new Error(`${this.logHead} you shouldn't startListening before closing last socket`);
    }
    this.UDPSocket = dgram.createSocket('udp4');
    this.UDPSocket.on('listening', () => {
      const address = (this.UDPSocket as dgram.Socket).address();
      this.pushLog(`start listening on port ${address.port}`);
    });
    this.UDPSocket.on('error', (err) => {
      (this.UDPSocket as dgram.Socket).close();
      throw new Error(`服务器异常：\n${err}`);
    });
    this.UDPSocket.on('message', (msg, remoteInfo) => {
      const packet = <Packet<any>> JSON.parse(msg.toString());
      // console.log(`${this.logHead} Get ${packet.protocol} packet from ${remoteInfo.address}:${remoteInfo.port},
      // src is ${packet.src}`);
      this.packetHandler(packet, remoteInfo);
    });
    this.UDPSocket.bind(this.port, "127.0.0.1");
  }

  private packetHandler(packet: Packet<any>, remoteInfo: dgram.AddressInfo) {
    if (this.neighbors.get(remoteInfo.port) === undefined) {
      console.warn(`${this.logHead} 从一个不是邻居的节点${remoteInfo.port}收到数据包${packet}`);
      return;
    }
    if ((this.state !== RouterState.on || this.UDPSocket == null)) {
      console.warn(`${this.logHead} 路由器在${this.state}状态下收到数据包，不做任何处理`);
      return;
    }
    if (packet.protocol === RoutingAlgorithm.ls && this.isNewLS(packet)) {
      // 没接收过的LS广播
      this.receivedLSSequenceNumber.set(packet.src, (<Packet<LSLinkState>> packet).data.sequenceNumber);
      this.neighbors.forEach((neighbor) => {
        if (remoteInfo.port !== neighbor.dest) {
          this.sendPacket(neighbor.dest, packet);
        }
      });
      this.LSUpdateAdjacencyListWithReceivedLS(packet.src, (<Packet<LSLinkState>> packet).data);
    } else if (packet.protocol === RoutingAlgorithm.dv) {
      this.DVUpdateNeighborsDVsWithReceivedDV(packet.src, (<Packet<DVItem[]>> packet).data);
    } else if (packet.protocol === 'data') {
      if (packet.dest === this.port) { // pkt to me
        this.pushLog(`receive message for me: ${packet.data}`);
      } else { // pkt to forward
        const entry = this.routeTable.get(packet.dest);
        if (entry !== undefined) {
          this.pushLog(`forward packet to ${entry.nextHop}`, packet);
        } else {
          this.pushLog(`don't know where to forward the packet!`, packet);
        }
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

  private startTimer() {
    if (this.algorithm === RoutingAlgorithm.ls) {
      this.timerIds.LSBroadcast = setInterval(() => {
        this.LSBroadcastLinkState(this.neighbors);
      }, 20 * 1000);
    }
  }

  private stopTimer() {
    if (this.timerIds.LSBroadcast) {
      clearInterval(this.timerIds.LSBroadcast);
      this.timerIds.LSBroadcast = null;
    }
  }

  // -----------------------------dv------------------------------------
  /**
   * @description Broadcast itself DV table to the neighbors
   */
  private DVInformNeighbors(dv: RouteTable) {
    // console.log(`${this.logHead} + start DV broadcast`);
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
          cost: routinTableItem.cost,
          dest: routinTableItem.dest
        });
      }
    });
    return dv;
  }

  /**
   * @description 当 neighbors 出现更新，根据 neighbors 来更新 neighborsDVs
   * @private
   * @param {Neighbors} neighbors
   */
  private DVUpdateNeighborsDVsWithNeighbors(neighbors: Neighbors): void {
    // Delete DV of routers that are not neighbors any more
    this.neighborsDVs.forEach((value, key, map) => {
      if (neighbors.get(key) === undefined) {
        this.neighborsDVs.delete(key);
      }
    });
    // Add DV of new neighbors
    neighbors.forEach((neighbor, neighborPort) => {
      if (this.neighborsDVs.get(neighborPort) === undefined) {
        // 如果发现A是本节点的邻居，但neighborsDVs中没有A的DV，那么为A初始化一个DV
        // 初始化的DV必须包括A到A自己的DVItem（cost为0），这样在DV算法中才能得到从本节点到A的路由
        const newDV: DV = new Map();
        newDV.set(neighborPort, {
          cost: 0,
          dest: neighborPort
        });
        this.neighborsDVs.set(neighborPort, newDV);
      }
    });
    // Update route table because neighborsDV change
    this.respondToNeighborsDVsChange(neighbors, this.neighborsDVs);
  }

  /**
   * @description 根据接收到的dv通告来更新neighborsDVs
   * @private
   */
  private DVUpdateNeighborsDVsWithReceivedDV(origin: number, dv: DVItem[]): void {
    if (!this.neighbors.has(origin)) { throw new Error(`${this.logHead} 从不是邻居的节点收到DV`); }
    const newDV: DV = new Map();
    dv.forEach(item => {
      newDV.set(item.dest, { dest: item.dest, cost: item.cost });
    });
    this.neighborsDVs.set(origin, newDV);
    this.respondToNeighborsDVsChange(this.neighbors, this.neighborsDVs);
  }

  private respondToNeighborsDVsChange(neighbors: Neighbors, neighborsDVs: Map<number, DV>) {
    if (this.algorithm !== RoutingAlgorithm.dv) {
      throw new Error(`${this.logHead} Calling respondToNeighborsDVsChange() when the mode is not 'dv'!`);
    }
    const newRouteTable = this.DVComputeRouteTable(neighbors, neighborsDVs);
    if (this.routeTablehasChanged(this.routeTable, newRouteTable)) {
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
  private routeTablehasChanged(oldRouteTable: RouteTable, newRouteTable: RouteTable): boolean {
    if (oldRouteTable.size !== newRouteTable.size) {
      return true;
    } else {
      oldRouteTable.forEach((val, key) => {
        const newEntry = newRouteTable.get(key);
        if (newEntry === undefined) {
          return true;
        } else if (newEntry.cost !== val.cost || newEntry.nextHop !== val.nextHop) {
          return true;
        }
      });
    }
    // console.log(`${this.logHead} The new route table is the same with the old.`);
    return false;
  }

  /**
   * @description DV算法的实现。
   * @private
   * @param {Neighbors} neighbors
   * @param {Map<number, DV>} neighborsDVs
   */
  private DVComputeRouteTable(neighbors: Neighbors, neighborsDVs: Map<number, DV>): RouteTable {
    if (neighbors.size !== neighborsDVs.size) {
      throw new Error(`${this.logHead} neighbors.size != neighborsDVs.size!`);
    }
    const newRouteTable: RouteTable = new Map();
    newRouteTable.set(this.port, { dest: this.port, cost: 0, nextHop: -1 });
    neighborsDVs.forEach((dv, neighbor) => {
      const neighborInfo = neighbors.get(neighbor);
      if (neighborInfo === undefined) {
        throw new Error(`${this.logHead} neighbor found in neighborsDVs is not found in neighbors!`);
      }
      dv.forEach((item, dest) => {
        const rtItem = newRouteTable.get(dest);
        if (rtItem === undefined || rtItem.cost > neighborInfo.cost + item.cost) {
          newRouteTable.set(dest, { dest: dest, cost: neighborInfo.cost + item.cost, nextHop: neighbor });
        }
      });
    });
    return newRouteTable;
  }

  // -----------------------------ls------------------------------------
  /**
   * @description 将LSLinkState广播到网络中的所有主机
   * TODO: 还是需要加上定时广播，否则在一些情况会出问题。
   */
  private LSBroadcastLinkState(neighbors: Neighbors) {
    // neighbors被转化为数组以后才能被序列化
    const neighborsArray: Neighbor[] = [];
    neighbors.forEach(neighbor => {
      neighborsArray.push(neighbor);
    });
    const linkState: LSLinkState = {
      neighbors: neighborsArray,
      sequenceNumber: this.NextLSSequenceNumber++
    };
    // 防止NextLSSequenceNumber变得过大
    if (this.NextLSSequenceNumber > 4096) {
      this.NextLSSequenceNumber = 0;
    }
    neighbors.forEach(neighbor => {
      this.sendPacket(neighbor.dest, {
        src: this.port,
        dest: neighbor.dest,
        protocol: RoutingAlgorithm.ls,
        data: linkState
      });
    });
  }

  /**
   * @description 用于判断接收到的LS广播是不是已经接收过
   * @private
   * @param {Packet<LSLinkState>} packet
   * @returns
   */
  private isNewLS(packet: Packet<LSLinkState>) {
    const lastSequenceNumber = this.receivedLSSequenceNumber.get(packet.src);
    const receivedSequenceNumber = (<Packet<LSLinkState>> packet).data.sequenceNumber;
    if (lastSequenceNumber === undefined  // 第一次收到这个节点发的LS
      || receivedSequenceNumber > lastSequenceNumber  // 接收到的LS更加新
      || lastSequenceNumber - receivedSequenceNumber > 1024
      // receivedSequenceNumber突然比lastSequenceNumber小很多
      // 说明发送者的sequenceNumber超过4096回到0了
    ) { return true; } else { return false; }
  }

  /**
   * @description 将新接收到的LS与存储的LS对比，是否发生变化
   * @private
   */
  private LinkStateIsSame(oldLS: Map<number, Neighbor> | undefined, newLS: Neighbor[]) {
    if (oldLS == null || oldLS.size !== newLS.length) { return false; }
    newLS.forEach(newNeighbor => {
      const oldNeighbor = oldLS.get(newNeighbor.dest);
      if (oldNeighbor == null || oldNeighbor.cost !== newNeighbor.cost) {
        return false;
      }
    });
    return true;
  }

  /**
   * @description 根据neighbors来更新AdjacencyList。
   * @private
   * @param {Neighbors} neighbors
   */
  private LSUpdateAdjacencyListWithNeighbors(neighbors: Neighbors) {
    // 将自己的邻居表直接替换成neighbors
    this.adjacencyList.set(this.port, neighbors);

    neighbors.forEach(neighbor => {
      const neighborsOfOtherNode = this.adjacencyList.get(neighbor.dest);
      // 修改每个邻居的邻居表，让它包括本节点
      if (neighborsOfOtherNode === undefined) {
        this.adjacencyList.set(neighbor.dest, new Map([[this.port, { dest: this.port, cost: neighbor.cost }]]));
      } else {
        neighborsOfOtherNode.set(this.port, { dest: this.port, cost: neighbor.cost });
      }
    });
    this.respondToAdjacencyListChange(neighbors, this.adjacencyList);
  }

  /**
   * @description 根据最新计算出的路由表来更新AdjacencyList。
   * 算法：
   * 对于不在路由表中的节点，说明它们已经不可达，应该删除它们对应的邻居表
   * @private
   * @param {RouteTable} routeTable
   */
  /*
  private LSUpdateAdjacencyListWithRouteTable(routeTable: RouteTable) {
    if (!routeTable.has(this.port)) { throw new Error("请确保路由表中包含到达自己的条目"); }
    this.adjacencyList.forEach((neighborsOfNode, nodePort) => {
      if (!routeTable.has(nodePort)) {
        this.adjacencyList.delete(nodePort);
      }
    });
    // 在这里不需要调用respondToAdjacencyListChange，因为删除的都是没有用的邻居表
  }
  */

  /**
   * @description 根据接收到的LS广播来更新AdjacencyList。
   * 算法：
   * 如果origin的邻居链表已经在AdjacencyList中，将邻居链表替换为广播中的邻居链表；
   * 如果origin的邻居链表不在AdjacencyList中，向AdjacencyList增加广播中的邻居链表。
   * @private
   */
  private LSUpdateAdjacencyListWithReceivedLS(origin: number, linkState: LSLinkState) {
    const oldLS = this.adjacencyList.get(origin);
    if (this.LinkStateIsSame(oldLS, linkState.neighbors)) {
      return;
    }
    const stringifiableOldLS = (oldLS === undefined) ? undefined : this.stringifiableNeighbors(oldLS);
    this.pushLog(`receive new link state of ${origin}`,
      { old: stringifiableOldLS, new: linkState.neighbors });
    // 将linkState转化为Neighbors
    const newNeighborsOfNode: Neighbors = new Map();
    linkState.neighbors.forEach((neighbor) => {
      newNeighborsOfNode.set(neighbor.dest, neighbor);
    });
    // 设置origin的邻居表
    this.adjacencyList.set(origin, newNeighborsOfNode);

    this.respondToAdjacencyListChange(this.neighbors, this.adjacencyList);
  }

  private respondToAdjacencyListChange(neighbors: Neighbors, adjacencyList: Map<number, Neighbors>) {
    if (this.algorithm !== RoutingAlgorithm.ls) {
      throw new Error("方法调用错了！");
    }
    const newRouteTable = this.LSRunDijkstra(adjacencyList);
    if (this.routeTablehasChanged(this.routeTable, newRouteTable)) {
      this.pushLog(`route table has changed`,
        { old: this.stringifiableRouteTable(this.routeTable), new: this.stringifiableRouteTable(newRouteTable) });
      this.routeTable = newRouteTable;
    } else {
      this.pushLog(`route table is the same`, this.stringifiableRouteTable(this.routeTable));
    }
    /*
    // 从AdjacencyList中删除那些已经无法到达的节点
    this.LSUpdateAdjacencyListWithRouteTable(newRouteTable);
    */
  }

  private LSRunDijkstra(adjacencyList: Map<number, Neighbors>): RouteTable {
    const resultRouteTable: RouteTable = new Map();
    // 初始化currentDist，currentDist用来存储Dijkstra算法需要的信息
    interface CurrentDistItem { cost: number; hasExpanded: boolean; nextHop: number; }
    const currentDist: Map<number, CurrentDistItem> = new Map();  // 以port为key
    this.adjacencyList.forEach((neighbors, port) => {
      // 将网络中所有节点加入currentDist
      currentDist.set(port, {
        cost: Number.MAX_SAFE_INTEGER + 1,
        hasExpanded: false,
        nextHop: -1 // 要去往port的下一跳路由
      });
    });
    const originDistInfo = currentDist.get(this.port);
    if (originDistInfo === undefined) {
      throw new Error("adjacencyList中没有自己的条目");
    }
    originDistInfo.cost = 0;
    originDistInfo.nextHop = -1;

    // 不断扩展节点，更新currentDist
    for (let i = 0; i < currentDist.size; i++) {
      // 找到下一个要扩展的节点（尚未扩展，但是距离原点距离最短的那个节点）
      let expandingRouter = -1;
      let minCost = Number.MAX_SAFE_INTEGER;
      currentDist.forEach((distInfo, port) => {
        if (distInfo.cost !== Number.MAX_SAFE_INTEGER &&
          Number.isSafeInteger(distInfo.cost) &&
          distInfo.cost < minCost &&
          !distInfo.hasExpanded) {
          expandingRouter = port;
          minCost = distInfo.cost;
        }
      });
      if (expandingRouter === -1 || minCost === -1) {
        // 路由算法找不到可以扩展的节点，提前结束
        break;
      }

      // 开始扩展expandingRouter
      const expandingRouterDistInfo = currentDist.get(expandingRouter) as CurrentDistItem;
      expandingRouterDistInfo.hasExpanded = true;

      // 将被选择扩展的节点加入路由表中
      resultRouteTable.set(expandingRouter,
        { dest: expandingRouter, cost: minCost, nextHop: expandingRouterDistInfo.nextHop });

      // expandingRouter的邻居表
      const expandingRouterNeighbors = this.adjacencyList.get(expandingRouter) as Neighbors;
      // 更新expandingRouter的所有邻居的neighborDistInfo
      expandingRouterNeighbors.forEach((expandingRouterNeighbor) => {
        const neighbors = this.adjacencyList.get(expandingRouterNeighbor.dest);
        if (neighbors === undefined || !neighbors.has(expandingRouter)) {
          // 检查expandingRouterNeighbor的邻居表中有没有expandingRouter
          // 如果没有，则无视这个expandingRouterNeighbor
          return;
        }

        const neighborDistInfo = currentDist.get(expandingRouterNeighbor.dest) as CurrentDistItem;
        // neighbor与原点的距离 > expandingRouter与原点的距离 + expandingRouter与expandingRouterNeighbor的距离
        if (neighborDistInfo.cost > expandingRouterDistInfo.cost + expandingRouterNeighbor.cost) {
          neighborDistInfo.cost = expandingRouterDistInfo.cost + expandingRouterNeighbor.cost;
          // 去往expandingRouterNeighbor的nextHop与去往expandingRouter的nextHop是一样的
          // 除非expandingRouter是本节点、expandingRouterNeighbor是邻居节点，此时nextHop直接就是邻居节点的port
          neighborDistInfo.nextHop = (expandingRouterDistInfo.nextHop === -1) ?
            expandingRouterNeighbor.dest : expandingRouterDistInfo.nextHop;
        }
      });
    }
    return resultRouteTable;
  }
}
