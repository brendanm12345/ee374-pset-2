import { objdb } from './store'
import { logger } from './logger'
import { txManager } from './txmanager'
import { stringify } from 'querystring';

const blake2 = require('blake2');

class ObjectManager {

    knownObjects: Set<Map<string, string>> = new Set();

    async load() {
        try {
            this.knownObjects = new Set(await objdb.get('transactions'));
            logger.debug(`Loaded known transactions: ${[...this.knownObjects]}`);
        }
        catch {
            logger.info(`Initializing transactions database`);
            this.knownObjects = new Set(); // Need to put the geneis transaction here i think?
            await this.storeObject();
        }
    }

    async getObject(objID: string) {
        return await objdb.get(objID);
    }
  
    async storeObject() {
        await objdb.put('transactions', [...this.knownObjects]);
        // gossip the object
    }

    // Verify the object and add it to the object database
    objectDiscovered(object: string) {
        // if the object is a tansaction
        if (JSON.parse(object).type != "transaction") {
            // Throw an error
        }

        if(!txManager.verifyTx(object)) {
            // Throw an error
        }

        // hash the object using blake2 and map it to the object
        var hash = blake2.createHash('blake2b');

        // create a map that maps a string to a string
        var mappedObject = new Map<string, string>();
        mappedObject.set(hash.update(object).digest('hex'), object);

        this.knownObjects.add(mappedObject);
        this.storeObject();
    }
}

export const objectManager = new ObjectManager();