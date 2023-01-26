import { network, messageSocket } from './network'
import { delay } from 'delay'

network = new Network()

const testId = "b303d841891f91af118a319f99f5984def51091166ac73c062c98f86ea7371ee"

export class Test {
  async initialMessages() {
    this.netSocket.write(`{"type":"hello","version":"jd3.x"}`);
    await delay(1000);
    this.netSocket.write(`{"type":"getpeers"}`);
    await delay(1000);
    this.netSocket.write(`{"type":"ihaveobject","objectid":"${testId}"}`);
  }
}

test('something working', () => {
  expect(Test.initialMessages().toBe());
});