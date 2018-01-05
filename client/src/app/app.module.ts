import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TJsonViewerModule } from 't-json-viewer';

import { AppComponent } from './app.component';
import { PanelComponent } from './panel/panel.component';

@NgModule({
  declarations: [
    AppComponent,
    PanelComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    TJsonViewerModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
