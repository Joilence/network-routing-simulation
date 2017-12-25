import { Router } from './router'

var r1 = new Router(11111);
var r2 = new Router(22222);
var r3 = new Router(33333);
var r4 = new Router(44444);
var r5 = new Router(55555);

var routers = [r1, r2, r3, r4, r5];

routers.forEach(router => {
    router.run();
});