import { NodeAPI } from 'node-red'
import { getServer } from './config-client.js'

export default function (RED: NodeAPI) {
  function aggregate(config) {
    RED.nodes.createNode(this, config)
    const node = this

    const paths: string[] = Array.isArray(config.paths)
      ? config.paths
          .map((p) => (typeof p === 'string' ? p : p && p.path))
          .filter((p) => typeof p === 'string' && p.length > 0)
      : []

    if (paths.length === 0) {
      node.error('no paths specified')
      node.status({ fill: 'red', shape: 'dot', text: 'no paths specified' })
      return
    }

    const server = getServer(RED, node)
    if (!server) {
      return
    }

    const context = config.context || 'vessels.self'
    const period =
      config.period !== undefined && config.period !== ''
        ? Number(config.period)
        : 1000

    let showingStatus = false
    function showStatus(triggerPath: string, value: any) {
      if (showingStatus) {
        return
      }
      const shortName = triggerPath.split('.').pop() || triggerPath
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `${shortName}: ${value}`
      })
      showingStatus = true
      setTimeout(() => {
        node.status({})
        showingStatus = false
      }, 1000)
    }

    function sendAggregate(
      triggerPath: string,
      inputMsg?: { topic?: string; payload?: any }
    ) {
      Promise.all(
        paths.map((path) =>
          server
            .getSelfPath(path)
            .then((res) => [
              path,
              res && res.value !== undefined ? res.value : null
            ])
            .catch(() => [path, null])
        )
      )
        .then((entries) => {
          const payload: Record<string, any> = {}
          for (const [path, value] of entries as [string, any][]) {
            payload[path] = value
          }
          if (inputMsg) {
            payload.input = inputMsg.payload
          }
          showStatus(triggerPath, payload[triggerPath])
          const topic =
            (config.topic && config.topic.length > 0 ? config.topic : null) ||
            (inputMsg && inputMsg.topic) ||
            triggerPath
          node.send({ topic, payload })
        })
        .catch((err) => server.onError(node, err))
    }

    let onStop: Array<() => void> = []

    function onDelta(delta) {
      if (!delta || !delta.updates) {
        return
      }
      for (const update of delta.updates) {
        if (!update.values) {
          continue
        }
        for (const pv of update.values) {
          if (paths.includes(pv.path)) {
            sendAggregate(pv.path)
            return
          }
        }
      }
    }

    const onAvailable = () => {
      for (const path of paths) {
        server.subscribe(context, path, period, onStop, onDelta)
      }
    }

    server.on('available', onAvailable)

    node.on('input', function (msg) {
      sendAggregate(paths[0], msg)
    })

    node.on('close', function () {
      server.removeListener('available', onAvailable)
      onStop.forEach((f) => f())
      onStop = []
    })
  }

  RED.nodes.registerType('signalk-aggregate', aggregate)
}
