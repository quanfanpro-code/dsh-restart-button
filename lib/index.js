// dsh-restart-button 服务端：注册 HTTP 通道，收到 restart 即拉起脱离父进程的重启脚本。
// DSH 0.1.5 起 connection.rpc.handle 内部依赖调用方上下文注入 webServer，
// 第三方插件无法通过该路径注册（官方核心包自身不再使用此 API）。
// 适配方案：改为直接注入 webServer 注册路由，按 connection RPC 信封格式自行解码。
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const RESTART_PS1 = join(here, "restart.ps1");
const CHANNEL = "/dsh-restart-button";

/**
 * 构造独立重启进程的 spawn 参数。导出以便自检测试。
 * node 与 bin.js 路径由调用方运行时传入，不写死，dsh 升级后依然正确。
 */
export function buildRestartSpawn({ nodePath, entryPath, parentPid, ps1Path = RESTART_PS1 }) {
	const windir = process.env.SystemRoot ?? "C:\\Windows";
	const powershell = join(windir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
	return {
		file: powershell,
		args: [
			"-NoProfile",
			"-ExecutionPolicy", "Bypass",
			"-File", ps1Path,
			"-NodePath", nodePath,
			"-EntryPath", entryPath,
			"-ParentPid", String(parentPid)
		],
		opts: { detached: true, stdio: "ignore", windowsHide: true }
	};
}

function writeJson(response, status, body) {
	const text = JSON.stringify(body);
	response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	response.end(text);
}

/** 与 connection RPC 信封一致的服务端应答。 */
function serverResponse(rpcId, result) {
	return { type: "server-response", rpcId, result };
}

function readBody(request) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		request.on("data", (chunk) => chunks.push(chunk));
		request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		request.on("error", reject);
	});
}

export const name = "restart-button";
export const inject = ["connection", "webServer"];

export function apply(ctx) {
	const logger = ctx.logger("restart-button");
	ctx.effect(() => {
		const dispose = ctx.webServer.register({
			kind: "prefix",
			path: CHANNEL,
			handler: async (request, response) => {
				// 与 connection.rpc.handle 相同的防护：Host/Origin 围栏 + 浏览器登录态。
				const rejection = ctx.connection.requestRejection(request);
				if (rejection !== void 0) {
					response.writeHead(rejection);
					response.end(rejection === 401 ? "unauthorized" : "forbidden");
					return;
				}
				const pathname = new URL(request.url ?? "/", "http://dsh.internal").pathname;
				const endpoint = pathname.startsWith(`${CHANNEL}/`) ? pathname.slice(CHANNEL.length + 1) : void 0;
				if (request.method !== "POST" || endpoint === void 0) {
					response.writeHead(404);
					response.end("not found");
					return;
				}
				let message;
				try {
					message = JSON.parse(await readBody(request));
				} catch {
					response.writeHead(400);
					response.end("body is not JSON");
					return;
				}
				const rpcId = typeof message?.rpcId === "string" ? message.rpcId : "";
				if (message?.type !== "client-request" || message.method !== endpoint) {
					writeJson(response, 200, serverResponse(rpcId, {
						ok: false,
						error: { code: "gateway/bad-request", message: "invalid client-request message", details: {} }
					}));
					return;
				}
				if (endpoint !== "restart") {
					writeJson(response, 200, serverResponse(rpcId, {
						ok: false,
						error: { code: "unknown-endpoint", message: `Unknown endpoint ${String(endpoint)}`, details: {} }
					}));
					return;
				}
				// 兜底入口：npm 全局安装 dsh 的默认位置；正常运行时 process.argv[1] 就是它。
				const entryPath = process.argv[1] ?? join(homedir(), "AppData", "Roaming", "npm", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
				const spec = buildRestartSpawn({ nodePath: process.execPath, entryPath, parentPid: process.pid });
				const child = spawn(spec.file, spec.args, spec.opts);
				child.unref();
				logger.info("restart requested: detached restarter spawned for pid %s", process.pid);
				// 应答送达后应用自行退出；重启脚本检测到进程消失即拉起新实例，强杀只是兜底。
				const timer = setTimeout(() => process.exit(0), 1500);
				timer.unref?.();
				writeJson(response, 200, serverResponse(rpcId, { ok: true, value: { started: true } }));
			}
		});
		return dispose;
	}, "restart-button: rpc channel");
}
