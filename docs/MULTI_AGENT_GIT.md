# Multi-agent Git (anti-collision)

Probleme cible: deux terminaux/agents poussent accidentellement sur la meme branche.

Solution imposee dans ce repo:
- 1 worktree par agent
- 1 branche dediee par agent (prefixe obligatoire)
- hook `pre-push` qui bloque les pushes non conformes

## Setup rapide

Depuis la racine du repo:

```bash
pnpm agent:init codex sav-flow origin/main
pnpm agent:init claude seo-pages origin/main
```

Chaque commande cree:
- un dossier de travail isole sous `/.worktrees/...`
- une branche unique: `<agent>/<topic>-<timestamp>`
- une config Git locale worktree (`trottistore.agent`)
- les hooks Git pour ce worktree

## Regles

- Un terminal/agent = un dossier worktree dedie.
- Ne pas travailler a plusieurs agents dans le meme dossier.
- Ne pas pousser `main`/`develop`.
- Le hook bloque un push si la branche ne commence pas par le prefixe agent du worktree.

Exemple:
- worktree configure avec `trottistore.agent=codex`
- branches autorisees: `codex/*`
- branche `claude/*` => push refuse

## Commandes utiles

Voir l'etat des worktrees:

```bash
pnpm agent:status
```

Installer les hooks sur un checkout existant:

```bash
pnpm agent:hooks
```

## Workflow recommande

1. Creer un worktree par agent.
2. Lancer chaque terminal dans son worktree.
3. Commits/push sur la branche dediee de l'agent.
4. Ouvrir une PR par branche agent.
