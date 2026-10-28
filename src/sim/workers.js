import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

// Ogni compito di tasks in un processo del file file (in sim/), tanti alla volta quanti i processori meno uno.
// Restituisce i loro risultati nell'ordine dei compiti
export async function inWorkers(file, tasks) {
  const results = [];
  let next = 0;
  const run = async () => {
    for (let index = next++; index < tasks.length; index = next++) results[index] = await inWorker(file, tasks[index]);
  };
  const workers = Math.max(1, Math.min(tasks.length, availableParallelism() - 1));
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

function inWorker(file, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(file, import.meta.url), { workerData });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}
