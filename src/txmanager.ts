import {logger} from './logger'

class TxManager {
    verifyTx(tx: string) {

        // Given a transaction in this structure {"height":0,"outputs":[{"pubkey":"958f8add086cc348e229a3b6590c71b7d7754e42134a127a50648bf07969d9a0","value":50000000000}],"type":"transaction"}
        // Check that the transaction is in the correct format
        








        // CHeck that each input contains the keys "ouput" and "sig". (public keys and signatures need
        // to be hexadecimal strings of required length)
            // Esnure that a valid tx by verifying the txid exists in the object db &
            // given index is less than unmber of outputs in the outpoint transaction
            // Ensure that the signature is valid

        

        // The index which is located in the input -> outpoint -> index must be non-neg integer

        // The value which is located in the outputs -> value must be a non-neg integer. outputs
        // -> public key is is in correct format

        // Transactions must respect the law of conservation
        return false;
    }
}
  
export const txManager = new TxManager();