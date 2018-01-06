export enum Command {
  createRouter,
  createLink,
  fetchNodeInfo,
  shutdownRouter,
  changeLinkCost,
  turnOnRouter,
  deleteRouter,
  deleteLink,
  log,
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

export interface Log {
  emitter: string, msg: string, json: any
}
