---
name: Postmortem Incident
about: Template pour documenter un incident et ses remédiations
title: "[POSTMORTEM] "
labels: incident, postmortem
---

## Résumé

**Date de l'incident :** YYYY-MM-DD
**Durée :** HH:MM (début → résolution)
**Sévérité :** P0 / P1 / P2
**Services impactés :**
**Responsable postmortem :**

## Timeline

| Heure (UTC) | Événement |
|---|---|
| HH:MM | Détection (alerte / utilisateur / monitoring) |
| HH:MM | Début investigation |
| HH:MM | Cause identifiée |
| HH:MM | Remédiation appliquée |
| HH:MM | Service restauré |

## Impact

- **Utilisateurs touchés :** (nombre estimé, segments)
- **Fonctionnalités dégradées :** (checkout, auth, SAV, etc.)
- **Perte de données :** oui / non
- **Impact business :** (commandes perdues, CA estimé, etc.)

## Cause racine

Description technique de la cause.

## Détection

Comment l'incident a été détecté (monitoring, alerte, signalement utilisateur).
Délai entre le début de l'incident et la détection.

## Remédiation

Actions prises pour résoudre l'incident :
1. ...
2. ...

## Ce qui a bien fonctionné

- ...

## Ce qui doit être amélioré

- ...

## Actions de suivi

| Action | Propriétaire | Priorité | Échéance | Ticket |
|---|---|---|---|---|
| | | P0/P1/P2 | YYYY-MM-DD | |

## Leçons apprises

- ...
