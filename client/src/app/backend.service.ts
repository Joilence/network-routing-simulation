import { Injectable } from '@angular/core';
import {
  Command,
  ServerSend,
  ClientSend,
  CreateRouterParam,
  CreateLinkParam,
  FetchNodeInfoParam
} from '../../../types';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

@Injectable()
export class BackendService {
  private readonly socket = new WebSocket('ws://localhost:8999');
  private _message: Subject<ServerSend<any>> = new Subject();
  public message = this._message.asObservable();

  constructor() {
    this.socket.addEventListener('open', (event) => {
      console.log('WebSocket open', event);
    });
    this.socket.addEventListener('error', (event) => {
      console.log('WebSocket error', event);
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      console.log('WebSocket message', message);
      this._message.next(message);
    });
    this.socket.addEventListener('close', (event) => {
      console.log('WebSocket close', event);
    });
  }

  addNode(routerId: number) {
    const sendObj: ClientSend<CreateRouterParam> = {
      command: Command.createRouter,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }

  addEdge(node1: number, node2: number, linkCost: number) {
    const sendObj: ClientSend<CreateLinkParam> = {
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
    const sendObj: ClientSend<FetchNodeInfoParam> = {
      command: Command.fetchNodeInfo,
      parameters: {
        routerId: routerId
      }
    };
    this.socket.send(JSON.stringify(sendObj));
  }
}
