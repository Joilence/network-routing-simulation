const chalk = require('chalk');

/**
 * Broadcast DV state periodically
 */
exports.DVBroadcastStateTable = function DVBroadcastStateTable(params) {
    console.log(`${this.logHead()} + start DV broadcast`);
    this.neighbors.forEach(router => {
        this.sendTo(neighbor.port, genDVStateTable(neighbor.port));
        console.log(`  send to ${router.port}`);
    });
}

/**
 * Update route table by DV state table received from others
 * @param { [{dest, cost}] } DVStateTable
 * @param {number} fromPort The port where the DV packet from
 */
exports.DVUpdateRouteTable = function DVUpdateRouteTable(DVStateTable, fromPort) {

    console.log(`${this.logHead()} update route table via DV packet from ${fromPort}`);

    DVStateTable.forEach(element => {
        var routeEntry = this.routeTable.get(element.dest);
        if (routeEntry === undefined) {
            // No corresponding entry found, and add new entry
            this.routeTable.push({
               dest: element.dest,
               cost: element.cost,
               toPort: fromPort,
               timestamp: new Date()
            });
        } else if (routeEntry.cost > element.cost) {
            // Found entry with higher cost, and update it
            routeEntry.cost = element.cost;
            routeEntry.toPort = fromPort;
            routeEntry.timestamp = new Date();
        }
    });
}

/**
 * Generate DV state table to broadcast
 * and do poison reverse
 * @param {number} dest the port number of router which DV packet heads to
 * @returns { [{dest, cost}] }
 */
exports.genDVStateTable = function genDVStateTable(dest) {
    var DVStateTable = [];
    this.routeTable.forEach(element => {
        if (element.toPort != dest) {
            DVStateTable.push({
                dest: element.dest,
                cost: element.cost
            })
        }   
    });
}