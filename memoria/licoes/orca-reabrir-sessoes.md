# Reabrir sessões Devin de panes mortos do Orca

Quando o Orca reinicia, os panes de terminal voltam como `cmd.exe` pelado — o agente
morre junto com o daemon antigo. Para reabrir:

1. `orca terminal list --json` (CLI em `%LOCALAPPDATA%\Programs\orca\resources\bin\orca.exe`)
   devolve `handle` por pane; o preview mostra o prompt pelado.
2. Pane → sessão se descobre pelo frame final em
   `%APPDATA%\orca\terminal-history\<ptyId-urlenc>\checkpoint.json` (campo
   `snapshotAnsi` = scrollback completo) cruzado com `%APPDATA%\devin\cli\transcripts\*.json`
   (nome do arquivo = slug da sessão).
3. **Lock antes de resumir**: `%APPDATA%\devin\cli\session_locks\<slug>.lock` contém o PID
   dono. Dono morto → apagar o .lock, senão `devin -r` falha com `session_locked`
   (a mesma pane pode ter acabado de tentar e falhado — conferir o preview).
4. `orca terminal send --terminal <handle> --text "devin --permission-mode bypass -r <slug>" --enter`.
5. Prova: título do pane vira `devin: <título original>` e o `.lock` volta a existir
   preso por processo vivo (Get-Content dá IOException de byte-range lock).
