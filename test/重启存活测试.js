// 验证真实 PowerShell 子进程在 Node 父进程退出后仍会执行，防止重启按钮只关不启。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'DSH重启存活测试-'));
const marker = join(dir, '子进程存活.txt');
const script = join(dir, '延时写入.ps1');
writeFileSync(script, '\ufeffStart-Sleep -Seconds 4\r\n' +
  `[IO.File]::WriteAllText('${marker.replaceAll("'", "''")}', 'CHILD_SURVIVED')\r\n`, 'utf8');
const moduleUrl = new URL('../lib/index.js', import.meta.url).href;
const parentCode = `import {spawn} from 'node:child_process';
import {buildRestartSpawn} from ${JSON.stringify(moduleUrl)};
const spec = buildRestartSpawn({nodePath:process.execPath, entryPath:process.argv[1] || 'probe', parentPid:process.pid, ps1Path:${JSON.stringify(script)}});
const child=spawn(spec.file,spec.args,spec.opts);
await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('启动失败 '+code)))});
child.unref();`;
const parent = spawnSync(process.execPath, ['--input-type=module', '-e', parentCode], {encoding:'utf8', windowsHide:true, timeout:10000});
assert.equal(parent.status, 0, parent.stderr);
assert.ok(!existsSync(marker), '启动器应先退出，重启脚本随后独立完成');
for (let n=0; n<60 && !existsSync(marker); n++) await new Promise(r=>setTimeout(r,100));
assert.ok(existsSync(marker), '父进程退出后，PowerShell 没有执行脚本');
assert.equal(readFileSync(marker,'utf8'),'CHILD_SURVIVED');
console.log('真实 PowerShell 存活测试通过');
