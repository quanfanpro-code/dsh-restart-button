// dsh-restart-button 服务端：注册 RPC 通道，收到 restart 即拉起脱离父进程的重启脚本。
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const RESTART_PS1 = join(here, "restart.ps1");

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

export const name = "restart-button";
export const inject = ["connection"];

export function apply(ctx) {
	const logger = ctx.logger("restart-button");
	ctx.effect(() => {
		const dispose = ctx.connection.rpc.handle(
			"/dsh-restart-button",
			(endpoint) => {
				if (endpoint !== "restart") {
					return { ok: false, error: { code: "unknown-endpoint", message: `Unknown endpoint ${String(endpoint)}`, details: {} } };
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
				return { ok: true, value: { started: true } };
			},
			{ authority: "loopback" }
		);
		return () => {
			dispose();
		};
	}, "restart-button: rpc channel");
}
