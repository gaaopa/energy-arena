# Qual rule vale para qual caminho

O Claude Code carrega estas automaticamente pelo frontmatter `paths:`. No Devin CLI o
frontmatter `globs:`/`trigger` cobre o mesmo; se a sua ferramenta não carrega rules por
caminho, leia à mão a rule do domínio antes de editar.

| Ao tocar em | Leia |
|---|---|
| sempre | `review.md` |
| `api/src/**`, `api/prisma/**` | `backend.md` + `armadilhas-backend.md` |
| `web/src/**` | `frontend.md` + `armadilhas-frontend.md` |
| `docker-compose.yml`, `api/.env*`, `api/prisma/**`, `package.json` | `infra.md` |
| `.claude/**`, `.devin/**`, `scripts/**` | `armadilhas-harness.md` |

Disciplina: armadilha nova entra na rule do domínio **no mesmo turno** em que for confirmada;
entrada que virar mentira sai no mesmo commit do fix estrutural.
