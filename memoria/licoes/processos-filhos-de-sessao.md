# Filhos de sessão morrem com ela — serviços duráveis nascem via Agendador

Incidente 2026-09-21: usuário reportava "cair da sessão"; cada queda matava a árvore
de processos filhos — API (`node dist/main.js` via `nohup &`) e Vite morriam juntos e
o login quebrava com 502 no proxy do Vite. `nohup`/`&` no Git Bash do Windows NÃO
desgruda o processo da árvore do agente.

Fix: `scripts/servicos.ps1` + tarefa `EnergyArena-DevServers` no Agendador (AtLogOn +
a cada 5 min, auto-cura). `subir` interativo delega à tarefa; `subir -Local` é o modo
interno que a própria tarefa usa. Processo nascido de tarefa fica fora da árvore de
qualquer sessão — prova: `status` mostra "sem pai vivo — detached". Postgres nunca
caiu porque já é serviço do Windows (`postgresql-x64-16`).

Segunda causa raiz descoberta depois: uma sessão paralela viva rodava keep-alive com
`taskkill` em `*dist/main.js*` + relançamento em foreground — matava TODA instância,
inclusive as destacadas. Duas sessões gerindo o mesmo serviço = guerra de porta.
Defesa: `EhNosso` ancora o match no `$Raiz` para nunca matar/tocar processo alheio.

Bônus: `.ps1` com acento gravado sem BOM é lido como ANSI pelo Windows PowerShell 5.1
e acentos viram bytes que corrompem strings (medido: `destacados` virou "comando").
`scripts/*.ps1` fica ASCII de propósito.

Gancho: ao subir serviço que o usuário depende entre sessões, nunca como filho do
exec — via Agendador/serviço, ou assumir que morre junto.
