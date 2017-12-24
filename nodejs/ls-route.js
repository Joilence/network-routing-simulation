exports.LSBroadcastState = function LSBroadcastState() {
  this.neighbors.forEach(neighbor => {
    this.sendTo(neighbor.port, {
      protocol: 'ls',
      origin: this.port,
      neighbors: this.neighbors
    });
  });
}

exports.LSUpdateRouteTable = function LSUpdateRouteTable(packet) {
  this.adjacencyList.get(packet.origin).neighbors = packet.neighbors;
  this.runDijkstra();
}

exports.runDijkstra = function runDijkstra() {
  this.adjacencyList;
}