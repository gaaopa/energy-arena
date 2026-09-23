# servicos.ps1 - dev servers da Energy Arena fora do ciclo de vida da sessao.
#
# Uso:
#   powershell -File scripts\servicos.ps1 instalar     # registra a tarefa no logon (uma vez)
#   powershell -File scripts\servicos.ps1 subir        # sobe via Agendador (destacado); sem
#                                                      tarefa instalada, sobe filho DESTA sessao
#   powershell -File scripts\servicos.ps1 parar        # para os dois (so se o dono da porta
#                                                      for o nosso node)
#   powershell -File scripts\servicos.ps1 status       # portas, PIDs e processo-pai
#   powershell -File scripts\servicos.ps1 desinstalar  # remove a tarefa
#
# Por que existe: processos lancados de dentro de uma sessao de agente/terminal morrem
# quando ela cai (foi o que derrubou a API e quebrou o login com 502 em 2026-09-21).
# So o nascimento via Agendador de Tarefas deixa o processo fora da arvore da sessao -
# por isso `subir` prefere disparar a tarefa a lancar daqui.
# Pre-requisito: `npm run build` (a API sobe de api/dist/main.js).
# web sobe com `--host` (aceita conexoes da LAN) - mesmo comportamento que rodava antes.
# NOTA: este arquivo e ASCII de proposito - Windows PowerShell 5.1 le .ps1 sem BOM
# como ANSI e acentos viram bytes que corrompem strings.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('subir', 'parar', 'status', 'instalar', 'desinstalar')]
  [string]$Verbo,
  # -Local: sobe daqui mesmo. E o modo que a tarefa usa (subir -Local); sem ele,
  # `subir` interativo prefere disparar a tarefa para nascer fora da sessao.
  [switch]$Local
)
$ErrorActionPreference = 'Stop'

$Raiz = Split-Path $PSScriptRoot -Parent
$Logs = Join-Path $Raiz 'logs'
$Tarefa = 'EnergyArena-DevServers'

$Vite = Join-Path $Raiz 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $Vite)) { $Vite = Join-Path $Raiz 'web\node_modules\vite\bin\vite.js' }

# cwd importa: ConfigModule le api/.env relativo ao diretorio de trabalho,
# e o Vite acha vite.config pelo cwd. Args[0] e o script node; o resto sao argumentos.
# Caminho absoluto em Args[0] faz o CommandLine conter $Raiz — e isso que ancora o
# match do Dono a ESTE projeto (um vite.js/dist/main.js de outro repo nao e nosso).
$Servicos = @(
  @{ Nome = 'api'; Porta = 3000; Dir = Join-Path $Raiz 'api'; Args = @((Join-Path $Raiz 'api\dist\main.js')); Dono = 'dist[/\\]main\.js' },
  @{ Nome = 'web'; Porta = 5173; Dir = Join-Path $Raiz 'web'; Args = @($Vite, '--host', '--port', '5173'); Dono = 'vite\.js' }
)

function DonoDaPorta([int]$Porta) {
  Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
}

# true so quando o processo e nosso: cmdline casa o script ($s.Dono) E ancora no $Raiz.
function EhNosso($proc, $s) {
  return ($null -ne $proc -and $proc.CommandLine -match $s.Dono -and $proc.CommandLine -like "*$Raiz*")
}

# true so quando quem escuta a porta e um processo nosso.
function NossoNaPorta($s) {
  $dono = DonoDaPorta $s.Porta
  if (-not $dono) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$dono" -ErrorAction SilentlyContinue
  return (EhNosso $proc $s)
}

switch ($Verbo) {
  'subir' {
    if (-not $Local -and (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue)) {
      try {
        Start-ScheduledTask -TaskName $Tarefa -ErrorAction Stop
      } catch {
        Write-Output "tick da tarefa ja em execucao - aguardando as portas"
      }
      $faltam = @($Servicos)
      for ($i = 0; $i -lt 60 -and $faltam.Count -gt 0; $i++) {
        Start-Sleep -Milliseconds 500
        $faltam = @($Servicos | Where-Object { -not (NossoNaPorta $_) })
      }
      if ($faltam.Count -eq 0) {
        Write-Output "tarefa '$Tarefa' subiu os dois servicos (destacados)"
      } else {
        Write-Output "tarefa disparada mas $($faltam.Nome -join ',') nao abriu em 30s - ver logs\ e Get-ScheduledTaskInfo '$Tarefa'"
      }
      break
    }
    if (-not $Local) {
      Write-Output "aviso: tarefa '$Tarefa' nao instalada - os processos nascem filhos DESTA sessao e morrem com ela (rode: instalar)"
    }
    # Node do WinGet mora em pasta de perfil; resolve aqui (e so aqui) porque so o
    # spawn precisa dele — status/parar/desinstalar nao devem falhar sem node no PATH.
    $Node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $Node) { throw 'node nao encontrado no PATH' }
    New-Item -ItemType Directory -Force $Logs | Out-Null
    foreach ($s in $Servicos) {
      $dono = DonoDaPorta $s.Porta
      if ($dono) {
        $donoProc = Get-CimInstance Win32_Process -Filter "ProcessId=$dono" -ErrorAction SilentlyContinue
        if (EhNosso $donoProc $s) {
          Write-Output "$($s.Nome): ja no ar (porta $($s.Porta), PID $dono)"
        } else {
          Write-Output "$($s.Nome): porta $($s.Porta) ocupada por outro processo ($($donoProc.Name) PID $dono) - nao subi"
        }
        continue
      }
      $alvo = $s.Args[0]
      $alvoAbs = if ([IO.Path]::IsPathRooted($alvo)) { $alvo } else { Join-Path $s.Dir $alvo }
      if (-not (Test-Path $alvoAbs)) { Write-Output "$($s.Nome): alvo ausente ($alvoAbs) - falta build? (npm run build)"; continue }
      $linha = ($s.Args | ForEach-Object { '"' + $_ + '"' }) -join ' '
      try {
        $p = Start-Process -FilePath $Node -ArgumentList $linha `
          -WorkingDirectory $s.Dir -WindowStyle Hidden -PassThru `
          -RedirectStandardOutput (Join-Path $Logs "$($s.Nome).out.log") `
          -RedirectStandardError (Join-Path $Logs "$($s.Nome).err.log") -ErrorAction Stop
      } catch {
        Write-Output "$($s.Nome): falha ao lancar - $($_.Exception.Message)"
        continue
      }
      $ok = $false
      for ($i = 0; $i -lt 20 -and -not $ok; $i++) { Start-Sleep -Milliseconds 500; $ok = NossoNaPorta $s }
      if ($ok) {
        Write-Output "$($s.Nome): subiu PID $($p.Id), ouvindo na porta $($s.Porta) (logs em $Logs)"
      } else {
        Write-Output "$($s.Nome): PID $($p.Id) nao abriu a porta $($s.Porta) em 10s - ver $Logs\$($s.Nome).err.log"
      }
    }
  }
  'parar' {
    foreach ($s in $Servicos) {
      $dono = DonoDaPorta $s.Porta
      if (-not $dono) { Write-Output "$($s.Nome): nada na porta $($s.Porta)"; continue }
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$dono" -ErrorAction SilentlyContinue
      if (-not $proc) { Write-Output "$($s.Nome): PID $dono ja morreu"; continue }
      if (-not (EhNosso $proc $s)) {
        Write-Output "$($s.Nome): porta $($s.Porta) e de outro processo ($($proc.Name) PID $dono) - nao mexi"
        continue
      }
      try {
        Stop-Process -Id $dono -Force -ErrorAction Stop
        Write-Output "$($s.Nome): PID $dono parado (porta $($s.Porta))"
      } catch {
        Write-Output "$($s.Nome): falha ao parar PID $dono - $($_.Exception.Message)"
      }
    }
  }
  'status' {
    foreach ($s in $Servicos) {
      $dono = DonoDaPorta $s.Porta
      if (-not $dono) { Write-Output "$($s.Nome): porta $($s.Porta) LIVRE"; continue }
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$dono" -ErrorAction SilentlyContinue
      $pai = $null
      if ($proc) { $pai = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)" -ErrorAction SilentlyContinue }
      $paiNome = if ($pai) { "$($pai.Name) (PID $($pai.ProcessId))" } else { 'sem pai vivo - detached' }
      Write-Output "$($s.Nome): porta $($s.Porta) PID $dono | pai: $paiNome | cmd: $($proc.CommandLine)"
    }
    $pg = Get-Service -Name 'postgresql-x64-16' -ErrorAction SilentlyContinue
    if ($pg) { Write-Output "postgres: servico $($pg.Status)" }
  }
  'instalar' {
    $acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
      -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" subir -Local"
    # Dois gatilhos: no logon (cobre reboot) e a cada 5 min (auto-cura: se uma sessao
    # derrubar o servico, a tarefa o recria destacado sem esperar o boot).
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $repete = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
    Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger @($logon, $repete) `
      -Description 'Sobe API (:3000) e web (:5173) da Energy Arena destacados de qualquer sessao' -Force | Out-Null
    Write-Output "tarefa '$Tarefa' registrada (AtLogOn + a cada 5 min, usuario $env:USERNAME)"
  }
  'desinstalar' {
    if (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false
      Write-Output "tarefa '$Tarefa' removida"
    } else {
      Write-Output "tarefa '$Tarefa' nao existia"
    }
  }
}
