export enum RouterState {
  /**
   * on表示路由器正常运行
   */
  on,
  /**
   * off表示路由器正常关机
   * 路由器正常断电以后所有的邻居都能立即知道，因为链路上的电压信号会立即消失
   */
  off,
  /**
   * fault表示路由器故障，电源仍然连通，链路上仍然存在电压信号，但是无法发出任何数据包
   * 此时邻居只能通过某种发现机制来知道这台路由器出现了故障
   */
  fault
}
export interface Neighbor {
  dest: number; cost: number;
}
export type Neighbors = Map<number, Neighbor>;  // 以dest为key

export interface RouteTableItem {
  dest: number;
  cost: number;
  nextHop: number;
}
export type RouteTable = Map<number, RouteTableItem>; // 以dest为key

export enum RoutingAlgorithm {
  ls = "ls", dv = "dv", centralized = "centralized"
}

export interface Packet<T> {
  // Packet中的src和dest相当于IP包首部的src和dest，在路由转发的过程中不改变。
  // 而UDP首部的src和dest相当于链路层帧的src和dest，在每经过一条路由都会改写。
  src: number;
  dest: number;
  protocol: RoutingAlgorithm | 'data';
  data: T;
}

export interface DVItem {
  dest: number;
  cost: number;
}
export type DV = Map<number, DVItem>;   // 以dest为key

export interface LSLinkState {
  neighbors: Neighbor[];
  sequenceNumber: number;
}