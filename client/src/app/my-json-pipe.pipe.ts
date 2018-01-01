import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'myJsonPipe',
  pure: false
})
export class MyJsonPipePipe implements PipeTransform {

  transform(value: any): string { return JSON.stringify(value, null, 6); }

}
