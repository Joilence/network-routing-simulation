Github: https://github.com/Joilence/network-routing-simulation/tree/dev
# 路由模拟项目介绍
链路状态协议（Link-state routing protocol）和距离向量路由协议（Distance-vector routing protocol）是分组交换（Packet switching）网络中最主要的两种路由协议。本项目的模拟路由器实现了LS路由算法、LS广播洪泛、DV路由算法，以及防止DV路由环路和无穷计数问题的策略。此外还实现了完整的前后端以便研究者通过UI界面自定义网络拓扑、控制路由器、查看路由器信息和日志。
## 链路状态算法（LS）
LS算法要求网络中**每个节点**都收集完整的网络信息，以图的形式存储整个网络的拓扑结构和所有链路费用，然后根据这个图来运行路由选择算法（在这里我们选择Dijkstra算法），计算出从本节点到网络中所有其他节点的最低费用路径。为了让每个节点都知道整个网络的拓扑结构和所有链路费用，每个节点都要将自己**直连**的链路信息**广播给网络中的所有节点**（LS广播）。

## 距离向量算法（DV）
DV算法不需要全局网络信息。每个节点只从**直连**邻居接收路由通告，执行DV计算，然后将计算结果分发给**直连**邻居。重复这个过程，直到每个节点的DV计算结果都与上一次的DV计算结果相同，此时网络中不再有路由通告，算法终止。

### 路由环路和无穷计数问题
由于DV算法没有全局网络信息，DV算法中可能会出现路由环路和无穷计数的问题。
> The Bellman–Ford algorithm does not prevent routing loops from happening and suffers from the count-to-infinity problem. The core of the count-to-infinity problem is that if A tells B that it has a path somewhere, there is no way for B to know if the path has B as a part of it.
如果A告诉B：A能到达C。由于B没有全局网络信息，它无法知道自己是否已经处于从A到C的路径上。
> https://en.wikipedia.org/wiki/Distance-vector_routing_protocol

为了避免路由环路和无穷计数，我们使用了[Split-horizon routing with poison reverse](https://en.wikipedia.org/wiki/Split_horizon_route_advertisement)和[Holddown](https://en.wikipedia.org/wiki/Holddown)的策略。详见路由器设计文档。

# 设计文档
## 路由器设计
https://www.processon.com/view/link/5a410029e4b0909c1aa58541
![模拟路由器设计图.png](http://upload-images.jianshu.io/upload_images/4888929-65af2c69ba45daab.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

### 路由器类的主要成员
* prot是本路由器的监听的端口。**路由器与路由器之间通过UDP socket进行通信**（交换路由信息、发送普通消息报文）。由于prot肯定是全局唯一的，因此我们也将它用作路由器的标识符。
* neighbors存储直连的邻居信息，包括邻居的port、链路的cost。为了加速查询，它的数据结构是一个以邻居port为key的Map。
    * 它是网络拓扑变化的根本来源，它的更新会触发ls算法或dv算法的执行、ls广播或dv通告。
    * 当修改网络拓扑时，修改它，网络拓扑的变化信息就能扩散到整个网络
    * adjacencyList、DVs的更新从根本上来说都来自于它的更新。
    * 详见 https://www.processon.com/diagraming/5a410028e4b0bf89b85a6c15
    * 算法为ls时，将它广播到整个网络
    * 算法为dv时，在计算自己的dv（也就是路由表）的时候需要用到它
* routeTable是路由器的路由表。用来转发数据包。
    * 它是ls或dv的计算结果，不要直接修改routeTable，而是修改数据来源（也就是neighbors或adjacencyList或neighborsDVs），然后触发路由算法，从而更新路由表。
    * 道理类似于：我们不应该直接修改编译器的输出代码，而应该去修改输入编译器的源代码，然后重新编译。从而输出会相应地改变。
* adjacencyList只在链路算法为ls的时候使用，它是存储了整个网络信息的邻接表。当接收到ls广播，或自己的直连链路变化（也就是neighbors变化），都要触发它的更新。
    * 使用邻接链表运行Dijkstra算法时，要忽略那些单向的链路（也就是说，如果A的邻居中有B，但B的邻居中没有A，那么不算这条链路）。
    * Dijkstra算法的输出只包括从本节点可达的节点，利用这一点，可以定期将adjacencyList中已经不可达的节点的邻居表删除。
* neighborsDVs（在设计图中的DVs）维护了所有邻居发来的DV通告。为了加速存取，它的数据结构是以邻居port为key的Map。
源代码的注释中包含更多信息。
    
   


## 前后端设计
前端是用Angular5和typescript制作的简单UI，运行在浏览器中；后端是用Node.js写的服务器，模拟路由是完全在后端进行的。前端与后端之间通过WebSocket而不是HTTP来通信，以便后端能主动、实时地发送信息给前端显示。

前端主要包含4个部分：
1. BackendService负责通过WebSocket与后端进行通信；
2. NetworkService负责根据后端发来的消息来绘制UI，并响应用户在UI上的操作；
3. PanelComponent负责展示用户选中的路由器或链路的信息，并提供一些针对选中对象的操作。
4. Chrome（或其他浏览器）控制台。后端运行的路由器实例产生的日志将通过Websocket连接发送到前端，前端将日志打印在控制台。用户如果想要查看路由器的运行过程需要打开控制台再刷新页面。由于浏览器的控制台自带filter功能，用户可以选择只查看某个路由器发出的日志、某种操作发出的日志。

后端主要包含3个文件：
1. server.ts负责监听WebSocket端口、调用RouterController来操作路由器和链路；
2. RouterController.ts负责维护并操作网络中所有的路由器实例，比如连接路由器、关闭路由器、改变路由器之间的链路，它提供操作网络的接口给server.ts；
3. router.ts定义了路由器类，其实现了ls算法和dv算法，并提供操作**单个**路由器的接口给RouterController.ts。

# 配置和运行
先安装[node.js](https://nodejs.org/en/)。
克隆[这个仓库](https://github.com/Joilence/network-routing-simulation)，**切换到dev分支**。
1. 运行后端程序。命令行进入server文件夹，依次执行“npm install”来安装后端依赖，“npm run build”来编译后端项目（此命令会一直监视文件变化并重新编译）。再打开一个命令行窗口并进入server文件夹，执行“npm run serve”来运行后端项目，看到server is listening on port 8999表示服务端成功运行。
![run server](http://upload-images.jianshu.io/upload_images/4888929-1d6bd48aa1c7f075.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

2. 运行前端程序。然后从命令行进入client文件夹，依次执行“npm install”和“ng serve”。看到已下信息表示客户端网页已经可以可以访问。
![client serve](http://upload-images.jianshu.io/upload_images/4888929-d9ac891cdd47d981.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
打开浏览器，访问 http://localhost:4200/ 即可。如果还想要查看路由器日志可以打开浏览器控制台并刷新页面。如果出现“socket发生错误，点击确定刷新页面”弹窗，表示客户端无法通过WebSocket连接到后端，请确保后端正在运行。

默认情况下，运行的是dv算法的路由器。如果要换成ls算法，修改“router.ts”的这一行：
![](http://upload-images.jianshu.io/upload_images/4888929-3089f674d27a12ef.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
将“dv”改为“ls”（“npm run build”命令行窗口会监测到变化并重新编译）。然后重新执行“npm run serve”来运行后端项目。

# 运行结果
![result](http://upload-images.jianshu.io/upload_images/4888929-9421a6fc4b01203c.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
左上角的操作栏可以添加、删除路由器和链路。点击路由器或链路，会在右边栏显示它的信息和一些操作。路由日志显示在浏览器控制台中，如果想要只查看某个路由器的日志或某个操作的日志，只需要在控制带的Filter输入框中输入过滤字符串，比如“9014log”，或“route table has changed”。

可以通过这个项目来自定义网络拓扑、操作网络拓扑，并观察路由表的变化。具体的例子在视频中展示。

# 阅读资料
《计算机网络 自顶向下方法 第六版》
https://en.wikipedia.org/wiki/Link-state_routing_protocol
https://en.wikipedia.org/wiki/Distance-vector_routing_protocol
https://en.wikipedia.org/wiki/Routing_loop_problem
https://en.wikipedia.org/wiki/Route_poisoning
https://en.wikipedia.org/wiki/Split_horizon_route_advertisement
https://en.wikipedia.org/wiki/Holddown
