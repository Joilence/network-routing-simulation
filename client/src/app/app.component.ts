import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { PanelComponent } from "./panel/panel.component";
import * as vis from 'vis';
import { NetworkService } from "./network-service.service";
import { BackendService } from './backend.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [NetworkService, BackendService]
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
