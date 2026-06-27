# Seiva Paraguay - WordPress WooCommerce

**Sitio:** https://seiva.com.py
**VPS:** 85.239.246.177:22 | usuario: opencodewordpress | pass: ver vault

## Estado
Auditoría completada. Pendiente Fase 2 (bugs) y Fase 3 (velocidad).
Ver `CONTEXT-SAVE.md` para detalle completo.

## Para retomar
1. Conectarse al VPS via SSH
2. Usar `sudo docker ps -a` para ver contenedores
3. WordPress container: `server_wordpress.1.idh2vydvjynlv0072uoss9vqm`
4. DB: MariaDB 11, user: mariadb, db: server | pass: ver vault
5. WP-CLI disponible en contenedor (--allow-root)
6. Ejecutar `/context-restore` en opencode para cargar contexto guardado

## Comandos útiles
- `sudo docker exec server_wordpress.1.idh2vydvjynlv0072uoss9vqm wp plugin list --allow-root`
- `sudo docker exec server_wordpress.1.idh2vydvjynlv0072uoss9vqm wp theme list --allow-root`
- `sudo docker exec server_wordpress-db.1.kqn3me32vioa91txmdnhr4awt mariadb -u mariadb -p server -e "SHOW TABLES;"`
- `sudo docker logs server_wordpress.1.idh2vydvjynlv0072uoss9vqm 2>&1 | grep -i error`

@C:/Users/salaz/.config/opencode/skills/gstack/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-autoplan/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-benchmark/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-benchmark-models/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-browse/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-canary/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-careful/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-claude/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-context-restore/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-context-save/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-cso/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-design-consultation/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-design-html/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-design-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-design-shotgun/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-devex-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-document-generate/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-document-release/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-freeze/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-guard/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-health/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-investigate/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-land-and-deploy/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-landing-report/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-learn/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-make-pdf/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-office-hours/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-open-gstack-browser/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-pair-agent/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-plan-ceo-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-plan-design-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-plan-devex-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-plan-eng-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-plan-tune/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-qa/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-qa-only/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-retro/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-scrape/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-setup-browser-cookies/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-setup-deploy/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-setup-gbrain/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-ship/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-skillify/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-sync-gbrain/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-unfreeze/SKILL.md
@C:/Users/salaz/.config/opencode/skills/gstack-upgrade/SKILL.md

@C:/Users/salaz/.config/opencode/skills/graphify/SKILL.md

@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman-commit/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman-compress/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman-help/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/caveman-stats/SKILL.md
@C:/Users/salaz/.config/opencode/skills/caveman/skills/cavecrew/SKILL.md

@C:/Users/salaz/.config/opencode/skills/superpowers/skills/brainstorming/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/dispatching-parallel-agents/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/executing-plans/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/finishing-a-development-branch/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/receiving-code-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/requesting-code-review/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/subagent-driven-development/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/diagnose/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/tdd/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/using-git-worktrees/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/using-superpowers/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/verification-before-completion/SKILL.md
@C:/Users/salaz/.config/opencode/skills/superpowers/skills/writing-plans/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/productivity/write-a-skill/SKILL.md

@C:/Users/salaz/.config/opencode/skills/frontend-design/skills/frontend-design/SKILL.md

@C:/Users/salaz/.config/opencode/skills/code-reviewer/SKILL.md
@C:/Users/salaz/.config/opencode/skills/senior-fullstack/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mobile-design/SKILL.md
@C:/Users/salaz/.config/opencode/skills/senior-architect/SKILL.md

@C:/Users/salaz/.config/opencode/skills/mcp-builder/SKILL.md
@C:/Users/salaz/.config/opencode/skills/file-organizer/SKILL.md
@C:/Users/salaz/.config/opencode/skills/senior-prompt-engineer/SKILL.md

@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/grill-with-docs/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/improve-codebase-architecture/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/prototype/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/setup-matt-pocock-skills/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/to-issues/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/to-prd/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/triage/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/engineering/zoom-out/SKILL.md

@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/productivity/grill-me/SKILL.md
@C:/Users/salaz/.config/opencode/skills/mattpocock-skills/skills/productivity/handoff/SKILL.md

