import {logger} from './logger'

class TxManager {
    verifyTx(tx: string) {
        return false;
    }
}
  
export const txManager = new TxManager();