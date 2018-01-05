import { Injectable, ElementRef } from '@angular/core';
import * as vis from 'vis';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/zip';
import 'rxjs/add/operator/bufferCount';
import { Subject } from 'rxjs/Subject';

import { PanelComponent } from "./panel/panel.component";
import { BackendService } from './backend.service';
import { Command } from '../../../types';

// https://github.com/almende/vis/blob/master/examples/network/events/interactionEvents.html
// http://visjs.org/docs/network/manipulation.html
// http://visjs.org/examples/network/events/interactionEvents.html
@Injectable()
export class NetworkService {

  // 存取node和edge的信息的方法：
  // https://stackoverflow.com/questions/35906493/accessing-node-data-in-vis-js-click-handler

  // create an array with nodes
  // http://visjs.org/docs/network/nodes.html
  readonly nodes = new vis.DataSet<{}>();

  // create an array with edges
  // http://visjs.org/docs/network/edges.html
  readonly edges = new vis.DataSet<{ to: number, from: number, linkCost: number }>();

  panel: PanelComponent;

  private nodesWaitingToBeCreated: Subject<{ x: number, y: number }> = new Subject();

  constructor(private backendService: BackendService) {
    backendService.nodeInfo.subscribe(message => {
      if (this.panel.showObject.id === message.data.routerId) {
        this.panel.showObject = {
          ...this.panel.showObject,
          routerInfo: message.data
        };
      }
    });

    backendService.createdNode.zip(this.nodesWaitingToBeCreated)
      .subscribe(([message, nodeToCreate]) => {
        const routerId = message.data.routerId;
        const node = {
          x: nodeToCreate.x,
          y: nodeToCreate.y,
          id: routerId,
          label: '' + routerId
        };
        this.nodes.add(node);
      });

    backendService.deletedNode.subscribe(message => {
      this.nodes.remove(message.data.routerId);
    });

    backendService.createdEdge.subscribe(message => {
      const { routerId1, routerId2, linkCost } = message.data;
      this.edges.add({ from: routerId1, to: routerId2, linkCost });
    });

    backendService.deletedEdge.subscribe(message => {
      const { routerId1, routerId2 } = message.data;
      const edgesIds = this.edges.getIds({
        filter: function (edge) {
          return (edge.from === routerId1 && edge.to === routerId2)
            || (edge.from === routerId2 && edge.to === routerId1);
        }
      });
      if (edgesIds.length !== 1) { throw new Error(`${routerId1}-${routerId1}之间的边不存在或者存在多条`); }
      this.edges.remove(edgesIds[0]);
    });

    backendService.logs.subscribe(message => {
      console.log(message.data);
    });

    // 删除节点的时候顺带删除相连的边
    this.nodes.on('remove', (event, info) => {
      const deleted_ids = info.items;
      // Find the edges which connect these nodes
      const edges = this.edges.getIds({
        filter: (item) => {
          return (deleted_ids.indexOf(item.to) !== -1) ||
            (deleted_ids.indexOf(item.from) !== -1);
        }
      });
      // Remove the found edges
      this.edges.remove(edges);
    });
    backendService.socketReady.subscribe(() => {
      this.createInitView();
    });
  }

  createNetwork(containerElement: ElementRef, panel: PanelComponent) {
    // create a network
    this.panel = panel;
    const container = containerElement.nativeElement;
    const data = {
      nodes: this.nodes,
      edges: this.edges
    };

    const options = {
      physics: {
        barnesHut: {
          springConstant: 0.01,
          damping: 1
        },
        minVelocity: 0.75
      },
      // http://visjs.org/docs/network/interaction.html
      interaction: {
        hover: true,
        selectConnectedEdges: false
      },
      manipulation: {
        // http://visjs.org/docs/network/manipulation.html
        enabled: true,
        initiallyActive: true,
        addNode: (nodeData, callback) => {
          this.backendService.addNode();
          this.nodesWaitingToBeCreated.next({ x: nodeData.x, y: nodeData.y });
          callback(null);
        },
        addEdge: (edgeData, callback) => {
          const node1 = this.nodes.get(edgeData.from);
          const node2 = this.nodes.get(edgeData.to);
          if ((node1 as any).shutdown || (node2 as any).shutdown) {
            callback(null);
            return;
          }
          const edges = this.edges.get({
            filter: (edge) =>
              (edge.from === edgeData.from && edge.to === edgeData.to)
              || (edge.from === edgeData.to && edge.to === edgeData.from)
          });
          if (edges.length > 0) {
            alert(`${edgeData.from}与${edgeData.to}之间已经存在链路，操作无效`);
            callback(null);
            return;
          }
          const linkCostStr = prompt(`请输入${edgeData.from}--${edgeData.to}链路的开销：`, '10');
          if (linkCostStr == null || linkCostStr === '') {
            callback(null);
            return;
          }
          const linkCost = Number(linkCostStr);
          if (!Number.isInteger(linkCost) || linkCost <= 0) {
            alert('输入不合法，操作取消');
            callback(null);
            return;
          }
          edgeData.linkCost = linkCost;
          this.backendService.addEdge(edgeData.from, edgeData.to, edgeData.linkCost);
          callback(null);
        },
        editEdge: false,
        deleteNode: (nodeData, callback) => {
          this.backendService.deleteRouter(nodeData.nodes[0]);
          callback(null);
        },
        deleteEdge: (edgeData, callback) => {
          const edge: any = this.edges.get(edgeData.edges[0]);
          this.backendService.deleteEdge(edge.from, edge.to);
          callback(null);
        }
      }
    };
    const network = new vis.Network(container, data, options);
    network.on("selectNode", (params) => {
      const node: any = this.nodes.get(params.nodes[0]);
      this.panel.showNode({ id: node.id, shutdown: node.shutdown });
      this.backendService.fetchNodeInfo(params.nodes[0]);
    });
    network.on("selectEdge", (params) => {
      const edge = this.edges.get(params.edges[0]);
      this.panel.showEdge(edge);
    });
  }

  shutdownRouter(routerId: number) {
    const node: any = this.nodes.get(routerId);
    if (node.shutdown) {
      alert(`${routerId}已经被关闭`);
      return;
    }
    node.color = {
      background: 'dimgray',
      border: 'black',
      highlight: { background: 'lightgrey', border: 'black' },
      hover: { background: 'gray', border: 'black' }
    };
    node.shutdown = true;
    this.nodes.update(node);
    this.panel.showNode({ id: node.id, shutdown: node.shutdown });
    this.backendService.shutdownRouter(routerId);
    setTimeout(() => {
      this.backendService.fetchNodeInfo(routerId);
    }, 100);
  }

  turnOnRouter(routerId: number) {
    const node: any = this.nodes.get(routerId);
    if (!node.shutdown) {
      alert(`${routerId}并不处于关闭状态`);
      return;
    }
    node.color = null;
    node.shutdown = false;
    this.nodes.update(node);
    this.panel.showNode({ id: node.id, shutdown: node.shutdown });
    this.backendService.turnOnRouter(routerId);
    setTimeout(() => {
      this.backendService.fetchNodeInfo(routerId);
    }, 100);
  }

  changeLinkCost(routerId1: number, routerId2: number, linkCost: number) {
    const edges = this.edges.get({
      filter: function (edge) {
        return (edge.from === routerId1 && edge.to === routerId2)
          || (edge.from === routerId2 && edge.to === routerId1);
      }
    });
    if (edges.length !== 1) { throw new Error(`${routerId1}-${routerId1}之间的边不存在或者存在多条`); }
    edges[0].linkCost = linkCost;
    this.edges.update(edges[0]);
    this.backendService.changeLinkCost(routerId1, routerId2, linkCost);
  }

  private createInitView() {
    this.backendService.addNode();
    this.backendService.addNode();
    this.backendService.addNode();
    this.nodesWaitingToBeCreated.next({ x: 0, y: 0 });
    this.nodesWaitingToBeCreated.next({ x: 20, y: 20 });
    this.nodesWaitingToBeCreated.next({ x: 40, y: 40 });
    this.backendService.createdNode.bufferCount(3).take(1).subscribe(([m1, m2, m3]) => {
      const nodeId1 = m1.data.routerId;
      const nodeId2 = m2.data.routerId;
      const nodeId3 = m3.data.routerId;
      this.backendService.addEdge(nodeId1, nodeId2, 30);
      this.backendService.addEdge(nodeId2, nodeId3, 50);
    });
  }
}
