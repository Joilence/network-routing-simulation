import * as WebSocket from 'ws';

import { Router } from './router';
import { RouterController } from './RouterController';
import {
  Command,
  ServerSend,
  ClientSend,
  NodeParam,
  LinkParam,
  Log,
  Communicate,
} from '../../types';

const wss = new WebSocket.Server({ port: 8999 });
let nextAvailablePort = 9011;

wss.on('connection', (ws: WebSocket) => {
  console.log('have connection');
  // // 在原始send方法上增加console.log，方便在服务器后台查看信息
  // const originalSend = ws.send.bind(ws);
  // ws.send = (sendObj: any) => {
  //   console.log("服务器返回指令", sendObj);
  //   originalSend(sendObj);
  // };

  const routerController = new RouterController();
  const logSubscription = routerController.logs.subscribe(log => {
    const sendObj: ServerSend<Log> = {
      command: Command.log,
      isSuccess: true,
      data: log
    };
    ws.send(JSON.stringify(sendObj));
  });
  // connection is up, let's add a simple simple event
  ws.on('message', (message: string) => {
    const receivedObject: ClientSend<any> = JSON.parse(message);
    console.log("服务端接收到指令:\n", receivedObject);
    let routerId: number;
    let routerId1: number;
    let routerId2: number;
    let linkCost: number;
    switch (receivedObject.command) {
      case Command.createRouter:
        routerId = routerController.createRouter(nextAvailablePort++);
        const res1: ServerSend<NodeParam> = {
          command: Command.createRouter,
          isSuccess: true,
          data: { routerId: routerId }
        };
        ws.send(JSON.stringify(res1));

        break;
      case Command.createLink:
        ({ routerId1, routerId2, linkCost } = (receivedObject as ClientSend<LinkParam>).parameters);
        routerController.createLink(routerId1, routerId2, linkCost);
        const res2: ServerSend<LinkParam> =
          { command: Command.createLink, isSuccess: true, data: { routerId1, routerId2, linkCost } };
        ws.send(JSON.stringify(res2));
        break;
      case Command.fetchNodeInfo:
        routerId = (receivedObject as ClientSend<NodeParam>).parameters.routerId;
        const routerInfo = routerController.getRouterInfo(routerId);
        const res3: ServerSend<any> = {
          command: Command.fetchNodeInfo,
          isSuccess: true,
          data: { ...routerInfo, routerId }
        };
        ws.send(JSON.stringify(res3));
        break;
      case Command.shutdownRouter:
        routerId = (receivedObject as ClientSend<NodeParam>).parameters.routerId;
        routerController.shutdownRouter(routerId);
        const res4: ServerSend<null> = { command: Command.shutdownRouter, isSuccess: true, data: null };
        ws.send(JSON.stringify(res4));
        break;
      case Command.changeLinkCost:
        ({ routerId1, routerId2, linkCost } = (receivedObject as ClientSend<LinkParam>).parameters);
        routerController.changeLinkCost(routerId1, routerId2, linkCost);
        const res5: ServerSend<null> = { command: Command.changeLinkCost, isSuccess: true, data: null };
        ws.send(JSON.stringify(res5));
        break;
      case Command.turnOnRouter:
        routerId = (receivedObject as ClientSend<NodeParam>).parameters.routerId;
        routerController.turnOnRouter(routerId);
        const res6: ServerSend<null> = { command: Command.turnOnRouter, isSuccess: true, data: null };
        ws.send(JSON.stringify(res6));
        break;
      case Command.deleteRouter:
        routerId = (receivedObject as ClientSend<NodeParam>).parameters.routerId;
        routerController.deleteRouter(routerId);
        const res7: ServerSend<NodeParam> = { command: Command.deleteRouter, isSuccess: true, data: { routerId } };
        ws.send(JSON.stringify(res7));
        break;
      case Command.deleteLink:
        ({ routerId1, routerId2 } = (receivedObject as ClientSend<LinkParam>).parameters);
        routerController.deleteEdge(routerId1, routerId2);
        const res8: ServerSend<LinkParam> =
          { command: Command.deleteLink, isSuccess: true, data: { routerId1, routerId2, linkCost: -1 } };
        ws.send(JSON.stringify(res8));
        break;
      case Command.communicate:
        const { sender, receiver, message: msg } = (receivedObject as ClientSend<Communicate>).parameters;
        routerController.routerCommunicate(sender, receiver, msg);
        const res9: ServerSend<null> =
          { command: Command.communicate, isSuccess: true, data: null };
        ws.send(JSON.stringify(res9));
        break;
    }
  });

  ws.on("error", (err) => {
    console.error("连接中断", err);
    ws.close();
  });

  ws.on("close", (code: number, reason: string) => {
    console.error("连接关闭", code, reason);
    logSubscription.unsubscribe();
    routerController.clearRouters();
  });

});

console.log(`server is listening on port 8999`);
