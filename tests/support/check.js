import assert from 'node:assert/strict';

// I controlli di un test: ognuno scrive la sua riga (OK o ERR, con quello che ha misurato) e alla fine il test fallisce
// se almeno uno è ERR. Così un blocco con due controlli li fa sempre tutti e due, come nella vecchia suite
export function checker(t) {
  const failed = [];
  const check = (label, ok) => {
    t.diagnostic(`${ok ? 'OK ' : 'ERR'} ${label}`);
    if (!ok) failed.push(label);
  };
  check.done = () => assert.deepEqual(failed, [], `controlli falliti:\n${failed.join('\n')}`);
  return check;
}
