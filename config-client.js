
import { Client } from '@signalk/client'

import coreDebug from 'debug'

export default function (RED) {
  'use strict'

  const debug = coreDebug('node-red-contrib-signalk:config-client')

  function ConfigSignalKClient (config) {
    debug('ConfigSignalKClient constructor called')

    RED.nodes.createNode(this, config)

    this.hostname = config.hostname
    this.port = config.port

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
      debug('ConfigSignalKClient connected to server, self', this.client.self)

      this.client.authenticate(config.username, config.password)
    })
    .catch(err => {
      debug('ConfigSignalKClient connection error:', err)
      this.error('Error connecting to Signal K server: ' + err.message)
    })

    this.client.on('self', (self) => {
      this.self = self
    })

    debug('ConfigSignalKClient created with hostname %s and port %d', this.hostname, this.port)
    
    this.on('close', function (done) {
      debug('ConfigSignalKClient closing connection')
      if (this.client) {
        this.client.close()
      }
      done()
    })

    this.client.on('error', function (err) {
      this.error('ConfigSignalKClient error:', err)
    })

    this.onError = (node, err) => {
      node.error(err)
      node.status({fill:"red",shape:"dot",text:err.message})
    }

    this.send = (node, msg) => {
      if (this.client && this.client.connection) {
        this.client.connection.send(msg)
        return true
      } else {
        const msg = 'Not connected to Signal K server'
        node.error(msg)
        node.status({fill:"red",shape:"dot",text:msg})
        return false
      }
    }
  }

  RED.nodes.registerType('signalk-client', ConfigSignalKClient)
}
