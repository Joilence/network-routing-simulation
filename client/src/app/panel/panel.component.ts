import { Component, OnInit } from '@angular/core';

enum PanelMode {
  showNode,
  showEdge,
  editNode,
  editEdge
}
import { NetworkService } from '../network-service.service';
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
  public showObject;

  constructor(private networkService: NetworkService) { }

  ngOnInit() {
  }

  showNode(node: Object) {
    this.mode = PanelMode.showNode;
    this.showObject = node;
  }

  showEdge(edge: any) {
    this.mode = PanelMode.showEdge;
    this.showObject = edge;
    this.linkCost = edge.linkCost;
  }

  linkCost: number;
  confirmInput: Function;
  createEdge(edgeData, callback) {
    this.mode = PanelMode.editEdge;
    this.linkCost = 10;
    this.confirmInput = (cancel = false) => {
      if (cancel) {
        callback(null);
        this.confirmInput = null;
        return;
      }
      console.log(edgeData);
      edgeData.linkCost = this.linkCost;
      callback(edgeData);
      this.confirmInput = null;
      this.mode = null;
    };
  }

  changeLinkCost(routerId1: number, routerId2: number, linkCost: number) {
    this.networkService.changeLinkCost(routerId1, routerId2, linkCost);
    this.mode = null;
  }
}
