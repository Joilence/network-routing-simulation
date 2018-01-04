export enum Command {
  createRouter,
  createLink,
  fetchNodeInfo,
  shutdownRouter,
  changeLinkCost,
  turnOnRouter,
  deleteRouter,
  deleteEdge
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

export interface NodeParam {
  routerId: number;
}

export interface LinkParam {
  routerId1: number;
  routerId2: number;
  linkCost: number;
}
