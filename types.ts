export enum Command {
  createRouter,
  createLink,
  fetchNodeInfo
}

export interface ClientSend<T> {
  command: Command;
  parameters: T;
}
export interface ServerSend<T> {
  command: Command;
  isSuccess: boolean;
  data: T;
}

export interface CreateRouterParam {
  routerId: number;
}

export interface CreateLinkParam {
  routerId1: number;
  routerId2: number;
  linkCost: number;
}

export interface FetchNodeInfoParam {
  routerId: number;
}

export interface NodeInfo {

}

