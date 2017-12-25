export interface Neighbor {
  port: number; cost: number;
}
export type Neighbors = Neighbor[];

export interface RoutingTableItem {
  dest: number;
  cost: number;
  nextHop: number;
  timestamp: Date;
}

export enum RoutingAlgorithm {
  ls, dv, centralized
}

export interface Packet<T> {
  src: number;
  dest: number;
  protocol: RoutingAlgorithm | 'data';
  data: T;
}

export interface DVItem {
  dest: number;
  cost: number;
}
export type DV = DVItem[];

export interface LSLinkState {
  origin: number;
  neighbors: Neighbor[];
  sequenceNumber: number;
}