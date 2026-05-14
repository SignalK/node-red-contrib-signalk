
import { Client } from '@signalk/client'

import coreDebug from 'debug'

export default function (RED) {
  'use strict'

  function ConfigSignalKClient (config) {
    RED.nodes.createNode(this, config)

    this.hostname = config.hostname
    this.port = config.port

    const debug = coreDebug(`node-red-contrib-signalk:config-client-${this.hostname}:${this.port}`)

    this.client = new Client({
      hostname: this.hostname,
      port: this.port,
      deltaStreamBehaviour: 'none',
      wsKeepaliveInterval: 10,
      reconnect: true,
      rejectUnauthorized: false,
      username: config.username,
      password: config.password,
      useTLS: config.useTLS,
      autoConnect: false,
      notifications: false
    })

    this.client.connect()
    .then(() => {
      debug('connected to server, self', this.client.self)
    })
    .catch(err => {
      debug('connection error:', err)
      this.error('Error connecting to Signal K server: ' + err.message)
    })

    this.client.on('connect', () => {
      debug('authenticating...')
      this.client.authenticate(config.username, config.password)
    })

    this.client.on('self', (self) => {
      this.self = self
    })

    debug('created with hostname %s and port %d', this.hostname, this.port)
    
    this.on('close', (done) => {
      debug('closing connection')
      if (this.client) {
        this.client.close()
      }
      done()
    })

    this.client.on('error', (err) => {
      this.error('error: ' + JSON.stringify(err))
    })

    this.onError = (node, err) => {
      node.error(err)
      node.status({fill:"red",shape:"dot",text:err.message})
    }

    this.send = (node, msg) => {
      return new Promise((resolve, reject) => {
        if (this.client && this.client.connection) {
          this.client.connection.send(msg)
            .then(() => {
              resolve(true)
            })
            .catch(err => {
              node.error('error sending message: ' + JSON.stringify(err))
              node.status({ fill: "red", shape: "dot", text: 'error sending message' })
              resolve(false)
            })
        } else {
          const msg = 'Not connected to Signal K server'
          node.error(msg)
          node.status({ fill: "red", shape: "dot", text: msg })
          resolve(false)
        }
      })
    }
  }

  RED.nodes.registerType('signalk-client', ConfigSignalKClient)
}
