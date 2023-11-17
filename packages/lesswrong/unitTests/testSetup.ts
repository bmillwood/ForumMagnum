import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AbortSignal } from "node-abort-controller";
// See https://github.com/openai/openai-node#customizing-the-fetch-client
import "openai/shims/node";

// Fix for Reference error AbortSignal in `lru-cache`
// See https://github.com/isaacs/node-lru-cache/issues/239
global.AbortSignal = AbortSignal as AnyBecauseHard;

jest.setTimeout(20000);

beforeAll(() => {
  chai.should();
  chai.use(chaiAsPromised);
});
