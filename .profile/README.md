# Maintaining this profile

The profile follows the evidence-first [design-github-profile skill](https://github.com/majiayu000/profile-control-plane/blob/3348f8e0d5e3a2ff2cce9a50e16396a65909718f/skills/design-github-profile/SKILL.md).

- `profile.yaml` declares identity, links, curated projects, and the real three-stage `Instagram.AI` workflow. It uses the upstream JSON Schema without extra fields.
- `narrative.md` holds the current role, engineering focus, learning path, and background in native Markdown.
- `build.mjs` uses the pinned Profile Control Plane compiler and its documented renderer interface. The supported `editorial` direction is adapted for larger type, narrow screens, and mode-specific contrast. It generates four SVGs and the README; never hand-edit those outputs.
- `DESIGN.md` records the evidence inventory and review.

From this directory, with Node.js 22.12 or later:

```sh
npm ci
npm run check
npm run build
npm run preview
```

The preview prints a local address; inspect `/` and `/light`. Generated files are written to `../README.md` and `../assets/`. Keep both color modes together. There are no hosted widgets, counters, scheduled jobs, or runtime requests in the profile.
