import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { PanelComponent } from "./panel/panel.component";
import * as vis from 'vis';
import { NetworkService } from "./network-service.service";
// https://github.com/almende/vis/blob/master/examples/network/events/interactionEvents.html
// http://visjs.org/docs/network/manipulation.html
// http://visjs.org/examples/network/events/interactionEvents.html
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [NetworkService]
})
export class AppComponent implements OnInit, AfterViewInit {

  @ViewChild("networkContainer") networkContainer: ElementRef;
  @ViewChild(PanelComponent) panel: PanelComponent;

  constructor(private networkService: NetworkService) { }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.networkService.createNetwork(this.networkContainer, this.panel);
  }
}
