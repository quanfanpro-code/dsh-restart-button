// dsh-restart-button 自检：spawn 参数构造 + RPC 通道注册（假 ctx，无框架依赖）。
// 运行：node test/run.js，全部通过输出 all checks passed，否则抛 AssertionError。
import assert from "node:assert";
import { buildRestartSpawn, apply, name, inject } from "../lib/index.js";

// 1. spawn 规格：powershell 全路径、脚本与参数、脱离父进程
const spec = buildRestartSpawn({
	nodePath: "C:\\Program Files\\nodejs\\node.exe",
	entryPath: "C:\\Users\\you\\AppData\\Roaming\\npm\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js",
	parentPid: 12345
});
assert.match(spec.file, /powershell\.exe$/i, "应调用系统 powershell.exe");
assert.ok(spec.args.includes("-File"), "应以 -File 方式执行脚本");
assert.ok(spec.args.some((a) => a.endsWith("restart.ps1")), "应指向包内 restart.ps1");
assert.ok(spec.args.includes("12345"), "应传入父进程 PID");
assert.equal(spec.opts.detached, true, "必须脱离父进程");
assert.equal(spec.opts.stdio, "ignore", "不应挂住父进程的 stdio");
assert.equal(spec.opts.windowsHide, true, "不应弹出窗口");

// 2. apply：注册 RPC 通道、authority loopback、dispose 干净、未知端点错误形状
const registered = [];
let disposed = false;
let disposer = null;
const fakeCtx = {
	logger: () => ({ info() {} }),
	effect(fn) {
		disposer = fn();
		return disposer;
	},
	connection: {
		rpc: {
			handle(channel, handler, opts) {
				registered.push({ channel, handler, opts });
				return () => {
					disposed = true;
				};
			}
		}
	}
};
assert.equal(name, "restart-button");
assert.deepStrictEqual(inject, ["connection"]);
apply(fakeCtx);
assert.equal(registered.length, 1, "应注册恰好一个通道");
assert.equal(registered[0].channel, "/dsh-restart-button");
assert.equal(registered[0].opts.authority, "loopback", "只允许本机回环调用");
assert.equal(typeof disposer, "function", "应返回清理函数");

const bad = await registered[0].handler("bogus", null);
assert.equal(bad.ok, false);
assert.equal(bad.error.code, "unknown-endpoint");

disposer();
assert.equal(disposed, true, "dispose 应释放通道");

console.log("all checks passed");
