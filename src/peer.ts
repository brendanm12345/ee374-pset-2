import { logger } from './logger'
import { MessageSocket } from './network'
import semver from 'semver'
import { Messages,
         Message, HelloMessage, PeersMessage, GetPeersMessage, ErrorMessage, GetObjectMessage, ObjectMessage, IHaveObjectMessage,
         MessageType, HelloMessageType, PeersMessageType, GetPeersMessageType, ErrorMessageType, GetObjectMessageType, ObjectMessageType, AnnotatedError, IHaveObjectMessageType } from './message'
import { peerManager } from './peermanager'
import { objectManager } from './objmanager'  // NEW
import { canonicalize } from 'json-canonicalize'
import { isGeneratorObject } from 'util/types'
import { objdb } from './store'

const VERSION = '0.9.0'
const NAME = 'Malibu (pset1)'

// handles connecting and handling errors for new peers
export class Peer {
  active: boolean = false
  socket: MessageSocket
  handshakeCompleted: boolean = false

  async sendHello() {
    this.sendMessage({
      type: 'hello',
      version: VERSION,
      agent: NAME
    })
  }
  async sendGetPeers() {
    this.sendMessage({
      type: 'getpeers'
    })
  }

  async sendPeers() {
    this.sendMessage({
      type: 'peers',
      peers: [...peerManager.knownPeers]
    })
  }

  // NEW
  async sendIHaveObject(objID: string) {
    this.sendMessage({
      type: 'ihaveobject',
      objectid: objID
    })
  }

  async sendGetObject(objID: string) {
    const requestedObj = await objectManager.getObject(objID);
      if (requestedObj) {  
      this.sendMessage({
        type: 'getobject',
        object: objID
      })
    } else {
      return await this.fatalError(new AnnotatedError('UNKNOWN_OBJECT', `Requested object not found of id: ${objID}`));
    }
  }

  async sendObject(objID: string) {
    this.sendMessage({
      type: 'object',
      object: objdb.get(objID)
    })
  }
  // NEW ^

  async sendError(err: AnnotatedError) {
    try {
      this.sendMessage(err.getJSON())
    } catch (error) {
      this.sendMessage(new AnnotatedError('INTERNAL_ERROR', `Failed to serialize error message: ${error}`).getJSON())
    }
  }

  sendMessage(obj: object) {
    const message: string = canonicalize(obj)
    this.debug(`Sending message: ${message}`)
    this.socket.sendMessage(message)
  }

  async fatalError(err: AnnotatedError) {
    await this.sendError(err)
    this.warn(`Peer error: ${err}`)
    this.active = false
    this.socket.end()
  }
  async onConnect() {
    this.active = true
    await this.sendHello()
    await this.sendGetPeers()
    await this.sendIHaveObject("1234567") // <-- only need to send the ID, not the whole object
  }
  async onTimeout() {
    return await this.fatalError(new AnnotatedError('INVALID_FORMAT', 'Timed out before message was complete'))
  }
  async onMessage(message: string) {
    this.debug(`Message arrival: ${message}`)

    let msg: object

    try {
      msg = JSON.parse(message)
      this.debug(`Parsed message into: ${JSON.stringify(msg)}`)
    }
    catch {
      return await this.fatalError(new AnnotatedError('INVALID_FORMAT', `Failed to parse incoming message as JSON: ${message}`))
    }
    if (!Message.guard(msg)) {
      return await this.fatalError(new AnnotatedError('INVALID_FORMAT', `The received message does not match one of the known message formats: ${message}`))
    }
    if (!this.handshakeCompleted) {
      if (HelloMessage.guard(msg)) {
        return this.onMessageHello(msg)
      }
      return await this.fatalError(new AnnotatedError('INVALID_HANDSHAKE', `Received message ${message} prior to "hello"`))
    }
    Message.match(
      async () => {
        return await this.fatalError(new AnnotatedError('INVALID_HANDSHAKE', `Received a second "hello" message, even though handshake is completed`))
      },
      this.onMessageGetPeers.bind(this),
      this.onMessagePeers.bind(this),
      this.onMessageError.bind(this),
      // NEW
      this.onMessageIHaveObject.bind(this),
      this.onMessageGetObject.bind(this),
      this.onMessageObject.bind(this),
      // NEW ^
    )(msg)
  }
  async onMessageHello(msg: HelloMessageType) {
    if (!semver.satisfies(msg.version, `^${VERSION}`)) {
      return await this.fatalError(new AnnotatedError('INVALID_FORMAT', `You sent an incorrect version (${msg.version}), which is not compatible with this node's version ${VERSION}.`))
    }
    this.info(`Handshake completed. Remote peer running ${msg.agent} at protocol version ${msg.version}`)
    this.handshakeCompleted = true
  }
  // passes in a message of tpye PeersMessageType. Iterates through each peer in array msg.peers
  // and logs that remote party is aware of it. Tells
  async onMessagePeers(msg: PeersMessageType) {
    for (const peer of msg.peers) {
      this.info(`Remote party reports knowledge of peer ${peer}`)

      peerManager.peerDiscovered(peer)
    }
  }
  async onMessageGetPeers(msg: GetPeersMessageType) {
    this.info(`Remote party is requesting peers. Sharing.`)
    await this.sendPeers()
  }
  async onMessageError(msg: ErrorMessageType) {
    this.warn(`Peer reported error: ${msg.name}`)
  }
  
  // NEW 
  async onMessageIHaveObject(msg: IHaveObjectMessageType) {
    objdb.get(msg.objectid).then((value: any) => {
      if (value) {
          console.log(`Object with id ${msg.objectid} is already in the database`);
      } else {
          console.log(`Requesting sender for object with id: ${msg.objectid}`);

          // Send getObject message
          this.sendGetObject(msg.objectid);
      }
  });
  }

  async onMessageGetObject(msg: GetObjectMessageType) {
    this.info(`Remote party is requesting object. Sharing.`);
    await this.sendObject(msg.objectid)
  }

  async onMessageObject(obj_msg: ObjectMessageType) {
    this.info(`Remote party is sending object: ${obj_msg.object}`);


    // Need to implement here !!!!!!!
    objectManager.objectDiscovered(obj_msg.object);
  }
  // NEW ^

  log(level: string, message: string) {
    logger.log(level, `[peer ${this.socket.peerAddr}:${this.socket.netSocket.remotePort}] ${message}`)
  }
  warn(message: string) {
    this.log('warn', message)
  }
  info(message: string) {
    this.log('info', message)
  }
  debug(message: string) {
    this.log('debug', message)
  }
  constructor(socket: MessageSocket) {
    this.socket = socket

    socket.netSocket.on('connect', this.onConnect.bind(this))
    socket.netSocket.on('error', err => {
      this.warn(`Socket error: ${err}`)
    })
    socket.on('message', this.onMessage.bind(this))
    socket.on('timeout', this.onTimeout.bind(this))
  }
}
