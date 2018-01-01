import * as dgram from "dgram";

import { Router } from './router';
export class RouterController {
  /**
   * @description 将客户端传来的ID映射为Router实例
   * 在客户端使用ID来标识一个路由器，在Router内部用Port标识一个路由器
   * @private
   * @memberof RouterController
   */
  private readonly IdToRouter = new Map<number, Router>();
  private nextAvailablePort = 9011;
  /**
   * @description 创建一个新的路由器实例
   * @param {number} routerId
   * @returns 是否成功
   * @memberof RouterController
   */
  public createRouter(routerId: number) {
    if (this.IdToRouter.has(routerId) === true) {
      throw new Error('id已经存在！');
    }
    const newRouter = new Router(this.nextAvailablePort++);
    try {
      newRouter.run();
    } catch (err) {
      console.error(`run路由器时失败, id: ${routerId}, port: ${this.nextAvailablePort - 1}`, err);
      return false;
    }
    this.IdToRouter.set(routerId, newRouter);
    return true;
  }

  public createLink(routerId1: number, routerId2: number, linkCost: number) {
    const router1 = this.IdToRouter.get(routerId1);
    const router2 = this.IdToRouter.get(routerId2);
    if (router1 === undefined || router2 === undefined) {
      console.error(`routerId1：${routerId1}或routerId2：${routerId2}不存在`);
      return false;
    }

    router1.connect(router2.port, linkCost);
    router2.connect(router1.port, linkCost);
    return true;
  }

  public getRouterInfo(routerId: number) {
    const router = this.IdToRouter.get(routerId);
    if (router === undefined) { throw new Error(`${routerId}不存在`); }
    return router.getRouterInfo();
  }

  public clearRouters() {
    this.IdToRouter.clear();
  }
}
