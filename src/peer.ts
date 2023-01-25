import { logger } from './logger'
import { MessageSocket } from './network'
import semver from 'semver'
import { Messages,
         Message, HelloMessage, PeersMessage, GetPeersMessage, ErrorMessage, GetObjectMessage, SendObjectMessage, IHaveObjectMessage,
         MessageType, HelloMessageType, PeersMessageType, GetPeersMessageType, ErrorMessageType, GetObjectMessageType, SendObjectMessageType, AnnotatedError, IHaveObjectMessageType } from './message'
import { peerManager } from './peermanager'
import { canonicalize } from 'json-canonicalize'
import { isGeneratorObject } from 'util/types'
import level from 'level-ts'

const VERSION = '0.9.0'
const NAME = 'Malibu (pset1)'

const db = new level('./tempdb');

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

  async sendIHaveObject(object: IHaveObjectMessageType) {
    this.sendMessage({
      type: 'ihaveobject',
      objectid: object.objectid
    })
  }

  async sendPeers() {
    this.sendMessage({
      type: 'peers',
      peers: [...peerManager.knownPeers]
    })
  }

  async sendObject(object: SendObjectMessageType) {
    this.sendMessage({
      type: 'object',
      object: object
    })
  }

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

    // Get object

  }
  // NEW
  async getObject(objectid: string) {
    this.info(`Remote party is requesting object: ${objectid}`) 
    // look up object.id and take result of this and send it if it exists
    // if it doesnt exist send and unknown object error
    const requestedObj = await db.get(objectid);
    if (requestedObj) {
      await this.sendObject(requestedObj);
    } else {
      return await this.fatalError(new AnnotatedError('UNKNOWN_OBJECT', `Requested object not found of id: ${object.objectid}`));
    }
    
  }
  // NEW ^

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
    await this.sendIHaveObject({
      type: "i have object",
      objectid: "1234567"
    })
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
      this.onMessageIHaveObject.bind(this),
      this.onMessageGetObject.bind(this),
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
  // hardcode db, ObjectIdMessageType
  async onMessageIHaveObject(object: IHaveObjectMessageType) {
    db.get(object.objectid).then((value: any) => {
      if (value) {
          console.log(`Object with id ${object.objectid} is already in the database`);
      } else {
          console.log(`Requesting sender for object with id: ${object.objectid}`);
          // request sender for object
          // We dont know what the object is, so we need to request that from the sender
          this.getObject(object.objectid);
          // should be sendMessage (getObject)
      }
  });
  }

  async onMessageGetObject(objectId: GetObjectMessageType) {
    // this.info(`Remote party is requesting peers. Sharing.`);
    // await this.getObject(objectId);
    await this.sendMessage({
      type: 'object',
      object: objectId
    })
      
  }

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
