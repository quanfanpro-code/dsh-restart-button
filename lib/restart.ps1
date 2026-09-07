param(
	[Parameter(Mandatory = $true)][string]$NodePath,
	[Parameter(Mandatory = $true)][string]$EntryPath,
	[Parameter(Mandatory = $true)][int]$ParentPid
)

# dsh-restart-button 的独立重启脚本：应用进程退出后按原命令重新拉起 dsh web。
# 由插件服务端以 detached 方式启动，不随应用一起退出。

$log = Join-Path ([Environment]::GetFolderPath('Desktop')) '插件重启结果.txt'
function Log([string]$m) {
	Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding UTF8
}

Set-Content -Path $log -Value ("[{0}] 重启按钮触发：等待应用进程 {1} 退出..." -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $ParentPid) -Encoding UTF8

# 等待应用进程退出（最多 15 秒；超时则强制结束）
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
	if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
	Start-Sleep -Milliseconds 500
}
try {
	Stop-Process -Id $ParentPid -Force -ErrorAction SilentlyContinue
} catch {
	# 进程已自行退出即为成功
}

Start-Sleep -Seconds 2

# 与原启动方式完全一致：node <bin.js> web --no-open，隐藏窗口
Start-Process -FilePath $NodePath -ArgumentList ('"{0}"' -f $EntryPath), 'web', '--no-open' -WindowStyle Hidden
Log ('新的 dsh web 进程已启动：node "{0}" web --no-open' -f $EntryPath)
