import { db } from './store'
import { logger } from './logger'
import isValidHostname from 'is-valid-hostname'

const BOOTSTRAP_PEERS = [
  '45.63.84.226:18018',
  '45.63.89.228:18018',
  '144.202.122.8:18018'
]

// PeerManager is a class that can load, discover, and store new peers
class PeerManager {
  // the set of peers
  knownPeers: Set<string> = new Set()

  // load in existing peers or bootstrap the peers list
  async load() {
    try {
      this.knownPeers = new Set(await db.get('peers'))
      logger.debug(`Loaded known peers: ${[...this.knownPeers]}`)
    }
    catch {
      logger.info(`Initializing peers database`)
      this.knownPeers = new Set(BOOTSTRAP_PEERS)
      await this.store()
    }
  }
  
  async store() {
    await db.put('peers', [...this.knownPeers])
  }

  // check that peer is valid and then add it to known peers
  peerDiscovered(peer: string) {
    const peerParts = peer.split(':')
    // check for host:port format
    if (peerParts.length != 2) {
      logger.warn(`Remote party reported knowledge of invalid peer ${peer}, which is not in the host:port format; skipping`)
      return
    }
    const [host, portStr] = peerParts
    const port = +portStr
    
    // checks that port is valid
    if (!(port >= 0 && port <= 65535)) {
      logger.warn(`Remote party reported knowledge of peer ${peer} with invalid port number ${port}`)
      return
    }
    // checks that host name is valid
    if (!isValidHostname(host)) {
      logger.warn(`Remote party reported knowledge of invalid peer ${peer}; skipping`)
      return
    }

    this.knownPeers.add(peer)
    this.store() // intentionally delayed await
  }
}

export const peerManager = new PeerManager()
