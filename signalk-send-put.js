import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-send-put')

export default function(RED) {
  function signalKSendPut(config) {
    RED.nodes.createNode(this,config)
    var node = this

    const server = RED.nodes.getNode(config.server)

    if (!server) {
      node.status({ fill: "red", shape: "dot", text: "missing server configuration" })
      return
    }

    node.on('input', msg => {
      node.status({fill:"yellow",shape:"dot",text:`sending...`})
      try {
        const path = config.path && config.path.length > 0 ? config.path : msg.topic
        server.putSelfPath(node, path, msg.payload, (reply) => {
          if ( reply.state === 'COMPLETED' ) {
            if ( reply.statusCode === 200 ) {
              node.status({fill:'green',shape:"dot",text:`value: ${msg.payload}`})
              node.send([{ payload: reply, putCallBack: msg.putCallBack}, null])
            } else if ( reply.state === 'PENDING' ) {
              node.status({fill:'yellow',shape:"dot",text:'pending...'})
            } else {
              node.status({fill:'red',shape:"dot",text:`error`})
              node.error(`put error ${reply.statusCode} ${reply.message || ''}`)
              node.send([null, { payload: reply, putCallBack: msg.putCallBack}])
            }
          }
        }, config.source && config.source.length > 0 ? config.source : undefined)
      } catch (err) {
        server.onError(node, err)
      }
    })
  }
  RED.nodes.registerType("signalk-send-put", signalKSendPut)
}
