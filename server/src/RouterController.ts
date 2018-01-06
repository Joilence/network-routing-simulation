import * as dgram from "dgram";
import { Subject } from 'rxjs/Subject';

import { Router } from './router';
import { Log } from '../../types';

export class RouterController {
  /**
   * @description 将客户端传来的ID映射为Router实例
   * 在客户端使用ID来标识一个路由器，在Router内部用Port标识一个路由器
   * @private
   * @memberof RouterController
   */
  private readonly IdToRouter = new Map<number, Router>();

  private _logs: Subject<Log> = new Subject();
  public logs = this._logs.asObservable();

  /**
   * @description 创建一个新的路由器实例
   * @returns 是否成功
   * @memberof RouterController
   */
  public createRouter(usePort: number) {
    const newRouter = new Router(usePort, (msg: string, json?: any) => {
      this._logs.next({ emitter: usePort + 'log', msg, json });
    });
    newRouter.run();
    this.IdToRouter.set(newRouter.port, newRouter);
    return newRouter.port;
  }

  public createLink(routerId1: number, routerId2: number, linkCost: number) {
    const router1 = this.IdToRouter.get(routerId1);
    const router2 = this.IdToRouter.get(routerId2);
    if (router1 === undefined || router2 === undefined) {
      throw new Error(`routerId1：${routerId1}或routerId2：${routerId2}不存在`);
    }
    router1.connect(router2.port, linkCost);
    router2.connect(router1.port, linkCost);
  }

  public getRouterInfo(routerId: number) {
    const router = this.IdToRouter.get(routerId);
    if (router === undefined) { throw new Error(`${routerId}不存在`); }
    return router.getRouterInfo();
  }

  public clearRouters() {
    this.IdToRouter.forEach(router => {
      router.shutdown();
    });
    this.IdToRouter.clear();
  }

  public shutdownRouter(routerId: number) {
    const router = this.IdToRouter.get(routerId);
    if (router === undefined) { throw new Error(`${routerId}不存在`); }
    router.shutdown();
    router.getNeighbors().forEach(neighbor => {
      const neighborRouter = this.IdToRouter.get(neighbor.dest);
      if (neighborRouter === undefined) { throw new Error(`${neighbor.dest}不存在`); }
      // 从邻居路由器中删除被shutdown的路由器
      neighborRouter.disconnect(router.port);
    });
  }

  public turnOnRouter(routerId: number) {
    const router = this.IdToRouter.get(routerId);
    if (router === undefined) { throw new Error(`${routerId}不存在`); }
    router.getNeighbors().forEach((neighbor) => {
      const neighborRouter = this.IdToRouter.get(neighbor.dest);
      if (neighborRouter === undefined) { throw new Error(`邻居${routerId}不存在`); }
      neighborRouter.connect(router.port, neighbor.cost);
    });
    router.run();
  }

  public changeLinkCost(routerId1: number, routerId2: number, linkCost: number) {
    const router1 = this.IdToRouter.get(routerId1);
    const router2 = this.IdToRouter.get(routerId2);
    if (router1 === undefined || router2 === undefined) { throw new Error(`${routerId1}或${routerId2}不存在`); }
    router1.changeLinkCost(routerId2, linkCost);
    router2.changeLinkCost(routerId1, linkCost);
  }

  public deleteRouter(routerId: number) {
    this.shutdownRouter(routerId);
    this.IdToRouter.delete(routerId);
  }

  public deleteEdge(routerId1: number, routerId2: number) {
    const router1 = this.IdToRouter.get(routerId1);
    const router2 = this.IdToRouter.get(routerId2);
    if (router1 === undefined || router2 === undefined) { throw new Error(`${routerId1}或${routerId2}不存在`); }
    router1.disconnect(routerId2);
    router2.disconnect(routerId1);
  }
}
