import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflows=fs.readFileSync(path.join(ROOT,'assets/js/app-workflows.js'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
test('la cola persistente almacena solo metadatos y usa una clave versionada del dispositivo',()=>{
 assert.match(workflows,/const BMM_PENDING_QUEUE_KEY = STORE_KEY \+ '\.cloud-pending-v1'/);
 assert.match(workflows,/schema:1,queuedAt:new Date\(\)\.toISOString\(\),reason:String\(reason\)\.slice\(0,80\),fingerprint:bmmQueueFingerprint\(state\),baseCloudUpdatedAt:state\?\.cloudUpdatedAt\|\|null/);
 assert.doesNotMatch(workflows,/BMM_PENDING_QUEUE_KEY[^;]*token|BMM_PENDING_QUEUE_KEY[^;]*password/i);
});
test('la cola se escribe antes de sincronizar y solo se limpia tras confirmación sin pendientes ni conflicto',()=>{
 const start=workflows.indexOf('const bmmSyncBeforePersistentQueue=bmmSyncNow;');
 const end=workflows.indexOf('const bmmLoadBeforePersistentQueue=bmmLoadCloud;',start);
 assert.ok(start>=0&&end>start);
 const block=workflows.slice(start,end);
 assert.match(block,/bmmPersistPendingQueue\('sync-in-progress'\)/);
 assert.match(block,/if\(ok&&!bmmCloudPending&&!bmmCloudConflictState\)/);
 assert.match(block,/bmmClearPendingQueue\(\)/);
 assert.match(block,/bmmCloudConflictState\?'conflict':'sync-pending'/);
});
test('la cola no fuerza escrituras ni sobrescribe el estado y no reintenta conflictos reales',()=>{
 const start=workflows.indexOf('const bmmSyncBeforePersistentQueue=bmmSyncNow;');
 const end=workflows.indexOf('// Ensure local and cloud save state is reflected after all overrides.',start);
 const block=workflows.slice(start,end);
 assert.match(block,/bmmCloudConflictState\|\|bmmHasUnresolvedLocalRecovery\(\)/);
 assert.match(block,/if\(!bmmCloudConflictState\)bmmAutoSyncWhenOnline=true/);
 assert.match(block,/if\(bmmReadPendingQueue\(\)&&bmmCloudPending&&!bmmCloudConflictState\)bmmSyncNow\(\)/);
 assert.doesNotMatch(block,/force:\s*true/);
});
test('la cola persistente y la caché PWA siguen alineadas con el código actual',()=>{
 assert.equal(pkg.version,'1.13.1');
 assert.match(workflows,/const BMM_APP_VERSION = '1\.13\.1'/);
 assert.match(sw,/v1\.13\.1-kpi-clean-build-20261012/);
});
