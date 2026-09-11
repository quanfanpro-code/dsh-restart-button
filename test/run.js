// dsh-restart-button 自检：spawn 参数构造 + HTTP 通道路由（假 ctx，无框架依赖）。
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

// 2. apply：注册 webServer 前缀路由、dispose 干净、认证拒绝、未知端点错误形状
const registered = [];
let disposed = false;
let disposer = null;
let rejection;
const fakeCtx = {
	logger: () => ({ info() {} }),
	effect(fn) {
		disposer = fn();
		return disposer;
	},
	connection: {
		requestRejection() {
			return rejection;
		}
	},
	webServer: {
		register(route) {
			registered.push(route);
			return () => {
				disposed = true;
			};
		}
	}
};
assert.equal(name, "restart-button");
assert.deepStrictEqual(inject, ["connection", "webServer"]);
apply(fakeCtx);
assert.equal(registered.length, 1, "应注册恰好一个路由");
assert.equal(registered[0].kind, "prefix");
assert.equal(registered[0].path, "/dsh-restart-button");
assert.equal(typeof disposer, "function", "应返回清理函数");

/** 构造最小 node 风格假请求/响应。 */
function fakeRequest({ method = "POST", url = "/dsh-restart-button/restart", body } = {}) {
	const listeners = {};
	return {
		method,
		url,
		on(event, fn) {
			listeners[event] = fn;
			if (event === "data" && body !== void 0) queueMicrotask(() => fn(Buffer.from(body)));
			if (event === "end") queueMicrotask(() => fn());
		}
	};
}
function fakeResponse() {
	return {
		status: 0,
		body: "",
		writeHead(code) {
			this.status = code;
		},
		end(text) {
			this.body = text ?? "";
		}
	};
}

// 未通过认证围栏：直接 401，不进业务逻辑
rejection = 401;
{
	const res = fakeResponse();
	await registered[0].handler(fakeRequest(), res);
	assert.equal(res.status, 401, "未认证应 401");
}

// 未知端点：ok:false + unknown-endpoint（不触发重启）
rejection = void 0;
{
	const res = fakeResponse();
	await registered[0].handler(fakeRequest({
		url: "/dsh-restart-button/bogus",
		body: JSON.stringify({ type: "client-request", rpcId: "t1", method: "bogus", payload: null })
	}), res);
	const reply = JSON.parse(res.body);
	assert.equal(reply.type, "server-response");
	assert.equal(reply.rpcId, "t1");
	assert.equal(reply.result.ok, false);
	assert.equal(reply.result.error.code, "unknown-endpoint");
}

// 非 POST：404
{
	const res = fakeResponse();
	await registered[0].handler(fakeRequest({ method: "GET" }), res);
	assert.equal(res.status, 404, "非 POST 应 404");
}

disposer();
assert.equal(disposed, true, "dispose 应释放路由");

console.log("all checks passed");
