import { Injectable } from '@angular/core';
import {
  Command,
  ServerSend,
  ClientSend,
  NodeParam,
  LinkParam
} from '../../../types';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

@Injectable()
export class BackendService {
  private readonly socket = new WebSocket('ws://localhost:8999');

  private _nodeInfo: Subject<ServerSend<any>> = new Subject();
  public nodeInfo = this._nodeInfo.asObservable();

  private _createdNode: Subject<ServerSend<NodeParam>> = new Subject();
  public createdNode = this._createdNode.asObservable();

  private _deletedRouter: Subject<ServerSend<NodeParam>> = new Subject();
  public deletedRouter = this._deletedRouter.asObservable();

  private _deletedEdge: Subject<ServerSend<LinkParam>> = new Subject();
  public deletedEdge = this._deletedEdge.asObservable();

  constructor() {
    this.socket.addEventListener('open', (event) => {
      console.log('WebSocket open', event);
    });
    this.socket.addEventListener('error', (event) => {
      console.log('WebSocket error', event);
      alert("socket发生错误，点击确定刷新页面");
      location.reload();
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      console.log('WebSocket message', message);
      switch (message.command) {
        case Command.fetchNodeInfo:
          this._nodeInfo.next(message);
          break;
        case Command.createRouter:
          this._createdNode.next(message);
          break;
        case Command.deleteRouter:
          this._deletedRouter.next(message);
          break;
        case Command.deleteEdge:
          this._deletedEdge.next(message);
          break;
      }
    });
    this.socket.addEventListener('close', (event) => {
      console.log('WebSocket close', event);
      alert("socket断开，点击确定刷新页面");
      location.reload();
    });
  }

  addNode() {
    const sendObj: ClientSend<null> = {
      command: Command.createRouter,
      parameters: null
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  addEdge(node1: number, node2: number, linkCost: number) {
    const sendObj: ClientSend<LinkParam> = {
      command: Command.createLink,
      parameters: {
        routerId1: node1,
        routerId2: node2,
        linkCost: linkCost
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  fetchNodeInfo(routerId: number) {
    const sendObj: ClientSend<NodeParam> = {
      command: Command.fetchNodeInfo,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  shutdownRouter(routerId: number) {
    const sendObj: ClientSend<NodeParam> = {
      command: Command.shutdownRouter,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  turnOnRouter(routerId: number) {
    const sendObj: ClientSend<NodeParam> = {
      command: Command.turnOnRouter,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  deleteRouter(routerId: number) {
    const sendObj: ClientSend<NodeParam> = {
      command: Command.deleteRouter,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  deleteEdge(routerId1: number, routerId2: number) {
    const sendObj: ClientSend<LinkParam> = {
      command: Command.deleteEdge,
      parameters: {
        routerId1, routerId2, linkCost: -1
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  changeLinkCost(routerId1: number, routerId2: number, linkCost: number) {
    const sendObj: ClientSend<LinkParam> = {
      command: Command.changeLinkCost,
      parameters: {
        routerId1, routerId2, linkCost
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }
}
