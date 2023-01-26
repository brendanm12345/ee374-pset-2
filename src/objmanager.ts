import { objdb } from './store'
import { logger } from './logger'
import { txManager } from './txmanager'

var blake2 = require('blake2');

class ObjectManager {

    knownObjects: Set<string> = new Set();

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
        if (object.type == "transaction") {

        txManager.verifyTx(object);

        // check that the incoming object is valid and add it to the object database

        // check that the transaction contains the keys "inputs" and "outputs"
        

        // CHeck that each input contains the keys "ouput" and "sig". (public keys and signatures need
        // to be hexadecimal strings of required length)
            // Esnure that a valid tx by verifying the txid exists in the object db &
            // given index is less than unmber of outputs in the outpoint transaction
            // Ensure that the signature is valid

        

        // The index which is located in the input -> outpoint -> index must be non-neg integer

        // The value which is located in the outputs -> value must be a non-neg integer. outputs
        // -> public key is is in correct format

        // Transactions must respect the law of conservation

        }
    }
}

export const objectManager = new ObjectManager();