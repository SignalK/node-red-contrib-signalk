# @signalk/node-red-contrib-signalk

Signal K nodes for Node-RED.

This package lets Node-RED flows read from a Signal K server, publish updates back into Signal K, handle PUT requests, expose switch-style controls, and, when running embedded, integrate directly with Signal K server internals.

## What You Get

- live subscriptions to Signal K paths and notifications
- on-demand reads of current values
- delta, notification, and PUT writers
- geofence and delta-processing helpers
- switch, slider, and dimmer control nodes with persisted state
- embedded-only nodes for app events, incoming deltas, input interception, and NMEA output

## Installation

Install from the Node-RED palette manager by searching for `@signalk/node-red-contrib-signalk`.

Or install manually in your Node-RED user directory:

```sh
npm install @signalk/node-red-contrib-signalk
```

Restart Node-RED after installation.

## Usage Modes

The package supports two runtime models.

### External Node-RED

Use this when Node-RED runs separately from Signal K server.

Most nodes talk to Signal K through the `signalk-client` config node, which manages the shared connection to the server.

Typical setup:

1. Install the package in Node-RED.
2. Add a `signalk-client` config node.
3. Enter the Signal K host, port, optional TLS setting, and optional credentials.
4. Add Signal K nodes to your flow and point them at that config node.

### Embedded Node-RED

Use this when Node-RED runs inside `signalk-server` via the `signalk-node-red` plugin.

In this mode, some nodes can access the server directly instead of going through a network connection. The editor also creates an internal `Embedded` Signal K config automatically for `signalk-*` nodes when needed.

Embedded-only nodes:

- `signalk-app-event`
- `signalk-input-handler`
- `signalk-input-handler-next`
- `signalk-on-delta`
- `signalk-send-nmea0183`
- `signalk-send-nmea2000`

## Signal K Client Config

`config-client` is the shared connection node used by most external-mode nodes.

Configuration fields:

- Host
- Port
- Use TLS
- Username
- Password

The config node handles connection, reconnects automatically, and provides helpers used by the other nodes for subscriptions, PUT requests, delta sending, and path lookups.

## Persistent Switch State

The switch and control nodes use a global context store named `skpersist` so their state survives restarts.

Nodes that use `skpersist`:

- `signalk-toggle-switch`
- `signalk-multi-switch`
- `signalk-dimmer-switch`
- `signalk-slider-switch`

### External Node-RED Setup

If you are running Node-RED outside Signal K server, add an `skpersist` context store to your Node-RED `settings.js`.

Example:

```js
contextStorage: {
	default: {
		module: 'memory'
	},
	skpersist: {
		module: 'localfilesystem',
		config: {
			cache: false
		}
	}
}
```

After updating `settings.js`, restart Node-RED.

### Embedded Node-RED Setup

When running embedded with `signalk-node-red`, `skpersist` is configured automatically if it does not already exist. The embedded plugin adds an `skpersist` context store backed by `localfilesystem`, so no manual setup is normally required.

## Quick Start

### Read A Value Stream

1. Add a `signalk-client` config node.
2. Add `signalk-subscribe`.
3. Set `path` to something like `navigation.speedOverGround`.
4. Wire it to a Debug node.
5. Deploy.

### Read A Current Value On Demand

1. Add `signalk-get`.
2. Configure a fixed path, or send the desired path in `msg.topic`.
3. Use output 1 for found values and output 2 for not found.

### Publish A Value

1. Add `signalk-send-pathvalue`.
2. Configure a path or send one in `msg.topic`.
3. Send the value in `msg.payload`.

## Node Overview

### Read And Subscription Nodes

#### `signalk-subscribe`

Subscribes to a Signal K path and emits updates from the configured context. It supports multiple subscription modes, optional source filtering, and flattened output.

When flattening is enabled, each outgoing message contains a single path/value pair using `msg.topic` and `msg.payload`, plus context and source metadata.

#### `signalk-notification`

Subscribes to notification updates and filters by notification path and state such as `normal`, `alert`, `warn`, `alarm`, or `emergency`.

#### `signalk-get`

Fetches the current value for a Signal K path. The path can be configured on the node or provided in `msg.topic`.

Outputs:

- output 1: found value
- output 2: not found

#### `signalk-on-delta`

Embedded-only. Emits messages for deltas received by the local Signal K server. It can emit the whole delta or flattened path/value messages.

#### `signalk-aggregate`

Subscribes to a list of Signal K paths. When any one of them produces a delta, the node looks up the current value of every configured path via `getSelfPath` and emits a single message.

Output:

- `msg.topic` &mdash; the input `msg.topic` if present, otherwise the configured Topic, otherwise the path that triggered the update
- `msg.payload` &mdash; an object mapping each configured path to its current value (or `null` if not available)

An input message also triggers an aggregation. The input `msg.topic` is passed through to the output, and the input `msg.payload` is included in the output payload under the key `input`.

#### `signalk-app-event`

Embedded-only. Listens for a named event on the server `app` object and forwards the event payload.

### Processing Nodes

#### `signalk-flatten-delta`

Turns a Signal K delta in `msg.payload` into one output message per path/value pair.

#### `signalk-filter-delta`

Filters a delta and emits only values matching the configured path.

#### `signalk-delay`

Delays forwarding until the input has remained unchanged for the configured delay period.

#### `signalk-geofence`

Checks vessel position against a circular geofence.

Outputs:

- output 1: inside
- output 2: outside
- output 3: state update

#### `signalk-geofence-switch`

Routes a message to one of two outputs depending on whether the vessel is currently inside or outside the configured fence.

### Write And Control Nodes

#### `signalk-send-pathvalue`

Sends a single Signal K value update using a configured path or `msg.topic`.

#### `signalk-send-delta`

Sends a complete Signal K delta from `msg.payload`.

#### `signalk-send-notification`

Sends a Signal K notification update. Node configuration can define defaults, and object payloads can override them per message.

#### `signalk-send-put`

Sends a Signal K PUT request.

Outputs:

- output 1: success
- output 2: error

#### `signalk-put-handler`

Registers PUT support for a specific Signal K path and emits incoming PUT requests into the flow.

When `Use Put Response` is disabled, the node responds immediately. When enabled, it returns `PENDING 202` and the flow must complete the request later with `signalk-put-success` or `signalk-put-error`.

#### `signalk-put-success`

Completes a pending PUT request successfully.

#### `signalk-put-error`

Completes a pending PUT request with an error.

### Switch And UI Control Nodes

These nodes keep state in the `skpersist` global context store.

#### `signalk-toggle-switch`

Exposes a boolean Signal K control path. If the configured path does not end in `.state`, the suffix is added automatically.

#### `signalk-multi-switch`

Exposes a multi-position control path backed by a configured list of allowed values.

#### `signalk-dimmer-switch`

Exposes a dimmer control using `.dimmingLevel`, and optionally `.state` when `Include State` is enabled.

#### `signalk-slider-switch`

Exposes a numeric control path with a configured range, optional units, and optional step size.

All four control nodes support `Use Put Response`. In that mode, PUT-originated changes are emitted into the flow with callback information and remain pending until the flow finishes the request with `signalk-put-success` or `signalk-put-error`.

### Embedded Integration Nodes

#### `signalk-input-handler`

Embedded-only. Intercepts incoming deltas before they are applied by the local Signal K server so a flow can inspect, modify, or suppress them.

#### `signalk-input-handler-next`

Embedded-only. Continues processing for a delta intercepted by `signalk-input-handler`, optionally using modified message fields to construct a replacement delta.

#### `signalk-send-nmea0183`

Embedded-only. Sends NMEA 0183 output through the local server.

#### `signalk-send-nmea2000`

Embedded-only. Sends NMEA 2000 output through the local server using either JSON or raw event payloads.

## Asynchronous PUT Flows

`signalk-put-handler` and the switch/control nodes can all participate in asynchronous PUT handling.

Typical pattern:

1. Enable `Use Put Response` on the node receiving PUT requests.
2. Let the flow validate or perform the requested action.
3. Send the result to `signalk-put-success` or `signalk-put-error`.

This is useful when the final outcome depends on external I/O, device acknowledgements, or business logic that cannot complete immediately.

## Notes

- Most nodes are intended for external Node-RED use through `signalk-client`.
- Embedded-only nodes depend on globals exposed by `signalk-server` and `signalk-node-red`.
- The package is published as an ES module package.

## License

Apache-2.0
