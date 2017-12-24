exports.LSBroadcastState = function LSBroadcastState(params) {
  this.neighbors.forEach(neighbor => {
    this.sendTo(neighbor.port, {
      protocol: 'ls',
      origin: this.port,
      neighbors: this.neighbors
    });
  });
}

exports.LSUpdateRouteTable = function LSUpdateRouteTable(params) {

}