import { v4 as uuidv4 } from 'uuid'
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-send-put')

export default function(RED) {
  function signalKSendPut(config) {
    RED.nodes.createNode(this,config)
    var node = this

    const server = RED.nodes.getNode(config.server)

    node.on('input', msg => {
      node.status({fill:"yellow",shape:"dot",text:`sending...`})
      try {
        const path = config.path && config.path.length > 0 ? config.path : msg.topic
        const requestId = uuidv4()

        const onMessage = (put) => {
          if (put.requestId === requestId) {
            debug('received put %j', put)
            if (put.state === 'COMPLETED' ) {
              server.client.removeListener('message', onMessage)
              if ( put.statusCode === 200 ) {
                node.status({fill:'green',shape:"dot",text:`success, value: ${msg.payload}`})
                node.send([msg , null])
              } else {
                node.status({fill:'red',shape:"dot",text:`error ${put.message || ''}`})
                node.error(`put error ${put.statusCode} ${put.message || ''}`)
                node.send([null, msg])
              }
            } else if ( put.state === 'PENDING' ) {
              node.status({fill:'yellow',shape:"dot",text:'pending...'})
            }
          }
        }
        server.client.on('message', onMessage)

        const put = {
          requestId,
          context: config.context || "vessels.self",
          put: { 
            path,
            value: msg.payload,
            source: config.source && config.source.length > 0 ? config.source : undefined
          }
        }
        debug('sending put %j', put)
        server.send(node, put).then((sent) => {
          if (sent) {
            node.status({fill:'green',shape:"dot",text:`sent value: ${msg.payload}`})
          }
        })
      } catch (err) {
        server.onError(node, err)
      }
    })
  }
  RED.nodes.registerType("signalk-send-put", signalKSendPut)
}
