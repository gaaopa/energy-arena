# Postgres caído sobe pelo serviço elevado, nunca por `pg_ctl` manual

Incidente 2026-09-23: login devolvia 500 (`P1001 Can't reach database server at
localhost:5432`). Causa: o serviço `postgresql-x64-16` tinha sido "encerrado
inesperadamente" às 14:14 (Event Log System, id 7034) — não foi falha de boot; algo o
matou, como no incidente do `taskkill` de 21/09.

O que deu errado ao remediar: sem elevação, subi o banco com
`pg_ctl start -D "C:/Program Files/PostgreSQL/16/data"` (barra do Git Bash) via
`Start-Process`. Funcionou até o dono rodar `Start-Service` elevado: o serviço colidiu na
porta, falhou por timeout, e a instância manual **se desligou sozinha** ("arquivo de
bloqueio do diretório de dados é inválido" — o `postmaster.pid` sumiu). Resultado: zero
postgres rodando e dois caminhos de log diferentes para o mesmo dado.

Regra: banco parado → `Start-Service postgresql-x64-16` num PowerShell elevado. Da sessão
do agente, elevação sem senha: `Start-Process powershell -Verb RunAs -ArgumentList
'-Command "Start-Service postgresql-x64-16"' -Wait` (dono clica Sim no UAC). Registrar
tarefa `S4U` no Agendador também exige elevação (`Register-ScheduledTask` → Acesso negado
sem admin); `servicos.ps1 instalar` cai para Interactive e avisa.

Pistas de diagnóstico que fecham rápido: `Get-Service postgresql-x64-16` (Stopped),
`Get-WinEvent -FilterHashtable @{LogName='System'; Id=7034}` (quem/quando matou),
`data/log/postgresql-<data>.log` (por que não subiu). Senha "errada" que dá 500 em vez de
401 nunca é senha.

Gancho: erro de login 500 → banco, não credencial; remediar pelo serviço, não por
processo da sessão.
