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

  private mode: PanelMode;

  public showObject;

  constructor(private networkService: NetworkService) { }

  ngOnInit() {
  }

  showNode(node: Object) {
    this.mode = PanelMode.showNode;
    this.showObject = node;
  }
  sendStr: string;
  toRouter: number;
  sendMsg(sendStr: string, toRouter: number) {
    this.networkService.sendMsg(this.showObject.id, sendStr, toRouter);
  }

  linkCost: number;
  showEdge(edge: any) {
    this.mode = PanelMode.showEdge;
    this.showObject = edge;
    this.linkCost = edge.linkCost;
  }

  changeLinkCost(routerId1: number, routerId2: number, linkCost: number) {
    this.networkService.changeLinkCost(routerId1, routerId2, linkCost);
    this.mode = null;
  }

  showNothing() {
    this.mode = null;
  }
}
