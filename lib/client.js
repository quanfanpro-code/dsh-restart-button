// dsh-restart-button 客户端：侧边栏底部“重启”按钮（与设置齿轮同排同风格）。
window.__ModuleLoader__.load({
	id: "dsh-restart-button",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";
		var react = require("react");
		var jsxRuntime = require("react/jsx-runtime");
		var primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		var name = "restart-button";
		var inject = ["slots", "connection", "locale"];
		var NS = "restartButton";
		var RPC_CHANNEL = "/dsh-restart-button";

		var zh = { label: "重启", restarting: "正在重启 DeepSeek Harness…" };
		var en = { label: "Restart", restarting: "Restarting DeepSeek Harness…" };

		// 与设置齿轮同参数的按钮样式（设计变量来自官方主题，宽/窄两种形态）。
		var STYLE_ID = "dsh-restart-button-style";
		var CSS = [
			".dsrb-btn{box-sizing:border-box;cursor:pointer;color:var(--dsw-alias-label-primary);",
			"background:transparent;border:none;display:flex;align-items:center;justify-content:center;",
			"gap:8px;font-family:inherit;font-size:14px;line-height:22px;min-width:0;flex:none;",
			"transition:background .15s ease}",
			".dsrb-btn.dsrb-wide{width:auto;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}",
			".dsrb-btn.dsrb-rail{width:36px;height:36px;border-radius:50%;padding:0}",
			".dsrb-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsrb-btn:disabled{cursor:default;opacity:.6}",
			".dsrb-label{white-space:nowrap;overflow:hidden}",
			".dsrb-spin{animation:dsrb-rotate 1s linear infinite}",
			"@keyframes dsrb-rotate{from{transform:rotate(0)}to{transform:rotate(360deg)}}",
			".dsrb-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45))}",
			".dsrb-overlay>div{background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary);",
			"border-radius:16px;padding:18px 26px;font-size:14px;line-height:22px;font-family:inherit}",
			".dsrb-overlay .dsrb-spin{display:inline-block;vertical-align:-2px;margin-right:8px}"
		].join("");

		function ensureStyle() {
			if (document.getElementById(STYLE_ID) === null) {
				var tag = document.createElement("style");
				tag.id = STYLE_ID;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
		}

		function showOverlay(t) {
			if (document.getElementById("dsrb-overlay") !== null) return;
			var mask = document.createElement("div");
			mask.className = "dsrb-overlay";
			mask.id = "dsrb-overlay";
			var box = document.createElement("div");
			var icon = document.createElement("span");
			icon.className = "dsrb-spin";
			icon.textContent = "⟳";
			box.appendChild(icon);
			box.appendChild(document.createTextNode(t("restarting")));
			mask.appendChild(box);
			document.body.appendChild(mask);
		}

		var restarting = false;
		function doRestart(ctx) {
			if (restarting) return;
			restarting = true;
			// 应用退出会让本请求没有响应，客户端不依赖它，只负责遮罩 + 轮询恢复。
			try {
				void ctx.connection.rpc.call(RPC_CHANNEL, "restart", null);
			} catch (error) {
				// 服务端可能已先一步退出，忽略。
			}
			var timer = setInterval(function () {
				fetch(location.href, { cache: "no-store" })
					.then(function () {
						clearInterval(timer);
						location.reload();
					})
					.catch(function () { /* 应用尚未恢复，继续等 */ });
			}, 1500);
		}

		function RestartButton(props) {
			var wide = props.wide === true;
			var t = props.t;
			return jsxRuntime.jsxs("button", {
				className: wide ? "dsrb-btn dsrb-wide" : "dsrb-btn dsrb-rail",
				title: t("label"),
				"aria-label": t("label"),
				onClick: function () { doRestart(props.__ctx); },
				children: [
					jsxRuntime.jsx(primitives.IconRefreshOutline14, { size: wide ? 16 : 18, className: "dsrb-icon" }),
					wide ? jsxRuntime.jsx("span", { className: "dsrb-label", children: t("label") }) : null
				]
			});
		}

		function apply(ctx) {
			ctx.effect(function () {
				ctx.locale.register(NS, { zh: zh, en: en });
			}, "restart-button: locale");
			ctx.effect(function () {
				ensureStyle();
			}, "restart-button: style");
			ctx.slots.inject("sidebar.footer.action", function () {
				return ctx.slots.register({
					name: "sidebar.footer.action",
					id: "restart-button",
					locale: NS,
					inject: function () {
						return { __ctx: ctx };
					}
				}, RestartButton);
			});
		}

		module.exports = { name: name, inject: inject, apply: apply };
		return module.exports;
	}
});
