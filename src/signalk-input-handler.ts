import { NodeAPI } from 'node-red'
export default function (RED: NodeAPI) {
  function SignalK(config) {
    RED.nodes.createNode(this, config)
    const node = this

    const plugin = node.context().global.get('plugin')
    if (!plugin) {
      node.status({
        fill: 'red',
        shape: 'dot',
        text: 'this node only works embedded'
      })
      return
    }

    const onClose = plugin.registerDeltaInputHandler(
      config.context,
      config.path,
      config.source,
      (pv, next) => {
        node.context().flow.set('signalk-input-handler.next', next)
        pv.next = next
        node.send(pv)
      }
    )

    node.on('close', function () {
      onClose()
    })
  }
  RED.nodes.registerType('signalk-input-handler', SignalK)
}
