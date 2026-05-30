import { NodeAPI } from 'node-red'
export default function (RED: NodeAPI) {
  function SignalK(config) {
    RED.nodes.createNode(this, config)
    const node = this

    const app = node.context().global.get('app')
    if (!app) {
      node.status({
        fill: 'red',
        shape: 'dot',
        text: 'this node only works embedded'
      })
      return
    }

    node.on('input', (msg) => {
      let next = node.context().flow.get('signalk-input-handler.next')
      if (msg.next) {
        next = msg.next
      }
      if (msg.topic) {
        const delta = {
          context: msg.context,
          updates: [
            {
              source: msg.source,
              $source: msg.$source,
              timestamp: msg.timestamp,
              values: [
                {
                  value: msg.payload,
                  path: msg.topic
                }
              ]
            }
          ]
        }
        next(delta)
      }
    })
  }
  RED.nodes.registerType('signalk-input-handler-next', SignalK)
}
