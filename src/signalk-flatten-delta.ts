import { NodeAPI } from 'node-red'
export default function (RED: NodeAPI) {
  function signalKFlattenDelta(config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.on('input', (msg) => {
      const delta = msg.payload
      if (delta.updates) {
        delta.updates.forEach((update) => {
          if (update.values) {
            update.values.forEach((pathValue) => {
              node.send({
                $source: update.$source,
                source: update.source,
                context: delta.context,
                payload: pathValue.value,
                topic: pathValue.path
              })
            })
          }
        })
      }
    })
  }
  RED.nodes.registerType('signalk-flatten-delta', signalKFlattenDelta)
}
