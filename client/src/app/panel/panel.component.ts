import { Component, OnInit } from '@angular/core';

import { NetworkService } from '../network-service.service';

enum PanelMode {
  showNode,
  showEdge,
  editNode,
  editEdge
}

@Component({
  selector: 'app-panel',
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.css']
})
export class PanelComponent implements OnInit {

  private _mode: PanelMode;
  set mode(m: PanelMode) {
    // 将原本的输入取消
    if (this.confirmInput != null) {
      this.confirmInput(true);
    }
    this._mode = m;
  }
  get mode() {
    return this._mode;
  }
  showString: string;
  set showObject(obj: Object) {
    this.showString = JSON.stringify(obj, null, 4);
    console.log(this.showString);
  }

  constructor(private networkService: NetworkService) { }

  ngOnInit() {
  }

  showNode(node: Object) {
    this.mode = PanelMode.showNode;
    this.showObject = node;
  }

  showEdge(edge: Object) {
    this.mode = PanelMode.showEdge;
    this.showObject = edge;
  }

  nodeLabel: string;
  nodeId: number;
  confirmInput: Function;
  editNode(nodeData, callback) {
    this.mode = PanelMode.editNode;
    this.nodeLabel = nodeData.label;
    this.nodeId = nodeData.id;
    this.confirmInput = (cancel = false) => {
      if (cancel) {
        callback(null);
        this.confirmInput = null;
        return;
      }
      nodeData.label = this.nodeLabel;
      nodeData.id = this.nodeId;
      try {
        callback(nodeData);
      } catch (error) {
        alert("ID重复！");
        return;
      }
      this.confirmInput = null;
      this.mode = null;
    };
  }

  fromId: number;
  toId: number;
  linkCost: number;
  editEdge(edgeData, callback) {
    console.log(edgeData);
    this.mode = PanelMode.editEdge;
    this.fromId = edgeData.from.id ? edgeData.from.id : edgeData.from;
    this.toId = edgeData.to.id ? edgeData.to.id : edgeData.to;
    this.linkCost = 10;
    this.confirmInput = (cancel = false) => {
      if (cancel) {
        callback(null);
        this.confirmInput = null;
        return;
      }
      edgeData.from = this.fromId;
      edgeData.to = this.toId;
      edgeData.linkCost = this.linkCost;
      try {
        callback(edgeData);
      } catch (error) {
        alert("edge修改失败");
        return;
      }
      this.confirmInput = null;
      this.mode = null;
    };
  }
}
