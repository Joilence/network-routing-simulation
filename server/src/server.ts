import * as WebSocket from 'ws';

import { Router } from './router';
import { RouterController } from './RouterController';
import {
  Command,
  ServerSend,
  ClientSend,
  CreateRouterParam,
  CreateLinkParam,
  FetchNodeInfoParam
} from '../../types';

const wss = new WebSocket.Server({ port: 8999 });
const routerController = new RouterController();

wss.on('connection', (ws: WebSocket) => {
  console.log('have connection');
  routerController.clearRouters();
  // connection is up, let's add a simple simple event
  ws.on('message', (message: string) => {
    const receivedObject: ClientSend<any> = JSON.parse(message);
    console.log("接收到消息", receivedObject);
    switch (receivedObject.command) {
      case Command.createRouter:
        if (routerController.createRouter((receivedObject as ClientSend<CreateRouterParam>)
          .parameters.routerId)) {
          const res: ServerSend<null> = { command: Command.createRouter, isSuccess: true, data: null };
          ws.send(JSON.stringify(res));
        }
        break;
      case Command.createLink:
        const param: CreateLinkParam = receivedObject.parameters;
        if (routerController.createLink(param.routerId1, param.routerId2, param.linkCost)) {
          const res: ServerSend<null> = { command: Command.createLink, isSuccess: true, data: null };
          ws.send(JSON.stringify(res));
        }
        break;
      case Command.fetchNodeInfo:
        const routerId = (receivedObject as ClientSend<FetchNodeInfoParam>).parameters.routerId;
        const routerInfo = routerController.getRouterInfo(routerId);
        const result: ServerSend<any> = {
          command: Command.fetchNodeInfo,
          isSuccess: true,
          data: { ...routerInfo, routerId }
        };
        ws.send(JSON.stringify(result));
        break;
    }
  });

  ws.on("error", (err) => {
    console.error("连接中断", err);
  });

});

console.log(`server is listening on port 8999`);
