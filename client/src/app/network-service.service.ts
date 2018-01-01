import { Injectable, ElementRef } from '@angular/core';
import * as vis from 'vis';

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
  // TODO: 将它作为服务

  // create an array with nodes
  // http://visjs.org/docs/network/nodes.html
  readonly nodes = new vis.DataSet<{}>();

  // create an array with edges
  // http://visjs.org/docs/network/edges.html
  readonly edges = new vis.DataSet<{ to: number, from: number, linkCost: number }>();

  panel: PanelComponent;

  constructor(private backendService: BackendService) {
    backendService.message.subscribe(message => {
      switch (message.command) {
        case Command.fetchNodeInfo:
          if (this.panel.showObject.id === message.data.routerId) {
            this.panel.showObject.routerInfo = message.data;
          }
        break;
      }
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
    // 删除节点的时候顺带删除相连的边
    data.nodes.on('remove', (event, info) => {
      const deleted_ids = info.items;
      // Find the edges which connect these nodes
      const edges = data.edges.getIds({
        filter: (item) => {
          return (deleted_ids.indexOf(item.to) !== -1) ||
            (deleted_ids.indexOf(item.from) !== -1);
        }
      });
      // Remove the found edges
      data.edges.remove(edges);
    });
    data.nodes.on('add', (event, info) => {
      info.items.forEach((id) => {
        this.backendService.addNode(id);
      });
    });
    data.edges.on('add', (event, info) => {
      info.items.forEach((id: number) => {
        const edge = data.edges.get(id);
        this.backendService.addEdge(edge.from, edge.to, edge.linkCost);
      });
    });
    const options = {
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
          this.panel.editNode(nodeData, callback);
        },
        addEdge: (edgeData, callback) => {
          this.panel.editEdge(edgeData, callback);
        },
        editEdge: {
          editWithoutDrag: (edgeData, callback) => {
            this.panel.editEdge(edgeData, callback);
          }
        }
      }
    };
    const network = new vis.Network(container, data, options);
    network.on("selectNode", (params) => {
      // console.log('selectNode Event:', params);
      const node = this.nodes.get(params.nodes[0]);
      this.panel.showNode(node);
      this.backendService.fetchNodeInfo(params.nodes[0]);
    });
    network.on("selectEdge", (params) => {
      // console.log('selectEdge Event:', params);
      const edge = this.edges.get(params.edges[0]);
      this.panel.showEdge(edge);
    });
    network.on("deselectNode", (params) => {
      // console.log('deselectNode Event:', params);
    });
    network.on("deselectEdge", (params) => {
      // console.log('deselectEdge Event:', params);
    });
  }

}
