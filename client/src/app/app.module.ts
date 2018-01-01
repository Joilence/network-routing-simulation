import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';


import { AppComponent } from './app.component';
import { PanelComponent } from './panel/panel.component';
import { MyJsonPipePipe } from './my-json-pipe.pipe';


@NgModule({
  declarations: [
    AppComponent,
    PanelComponent,
    MyJsonPipePipe
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
