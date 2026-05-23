
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-put-success')

export default function(RED) {
  function SignalK(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    node.on('input', msg => {
      server.sendPutResponse(node, msg, {
        state: "COMPLETED",
        statusCode: msg.statusCode || 200,
        message: msg.message
      })
    })
  }
  RED.nodes.registerType("signalk-put-success", SignalK);
}

