import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EditorialRenderer,
  checkCompiledProfile,
  compileProfile,
  loadProfileConfig,
  startPreviewServer,
} from 'profile-control-plane';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(sourceDirectory, '..');
const config = await loadProfileConfig(resolve(sourceDirectory, 'profile.yaml'));
const narrative = await readFile(resolve(sourceDirectory, 'narrative.md'), 'utf8');

const xml = (value) => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));
const label = (value) => String(value).replace(/[\\`*_[\]<>]/g, '\\$&');
const repositoryUrl = (name) => `https://github.com/${encodeURIComponent(config.github.username)}/${encodeURIComponent(name)}`;

function wrap(value, limit) {
  const lines = [];
  let line = '';
  for (const word of value.trim().split(/\s+/)) {
    if (line && `${line} ${word}`.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function palette(mode) {
  return mode === 'dark' ? {
    background: '#121C1B', ink: '#F4EFE2', muted: '#BFC9BF',
    rule: '#3E514B', primary: '#E3B785', secondary: '#B3C9BD', soft: '#1D2B28',
  } : {
    background: '#F4EFE2', ink: '#1B2E28', muted: '#4F6056',
    rule: '#B9C5B9', primary: config.theme.primary, secondary: config.theme.secondary, soft: '#E6EBDD',
  };
}

function svgFrame(mode, height, title, contents) {
  const colors = palette(mode);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="title description" data-mode="${mode}">
  <title id="title">${xml(title)}</title>
  <desc id="description">An editorial profile with large typography. Full descriptions are also available as native text in the README.</desc>
  <style>
    text{font-family:Arial,Helvetica,sans-serif}
    .display{font-family:Georgia,'Times New Roman',serif;letter-spacing:-3px}
    .label{font-family:Arial,Helvetica,sans-serif;letter-spacing:2px}
    .signal{stroke-dasharray:4 10;animation:signal 12s linear infinite}
    @keyframes signal{to{stroke-dashoffset:-140}}
    @media(prefers-reduced-motion:reduce){.signal{animation:none}}
  </style>
  <rect width="1000" height="${height}" fill="${colors.background}"/>
  <rect x="20" y="20" width="960" height="${height - 40}" fill="none" stroke="${colors.rule}"/>
  ${contents}
</svg>\n`.replace(/[ \t]+$/gm, '');
}

// Adapt the supported editorial direction through the compiler's renderer interface.
// All assets are generated from source; no generated SVG is modified after compilation.
class ReadableEditorialRenderer extends EditorialRenderer {
  renderHero(profile, mode) {
    const colors = palette(mode);
    const words = profile.identity.headline.trim().split(/\s+/);
    const split = Math.ceil(words.length / 2);
    const headline = [words.slice(0, split).join(' '), words.slice(split).join(' ')].filter(Boolean);
    if (headline.some(line => line.length > 14)) throw new Error('Hero headline needs shorter lines.');
    const currentRole = profile.identity.tagline.split('.')[0];
    if (currentRole.length > 42) throw new Error('The short role label needs a shorter first sentence.');
    return svgFrame(mode, 570, `${profile.identity.name}: ${profile.identity.headline}`, `
    <rect x="55" y="55" width="12" height="32" fill="${colors.primary}"/>
    <text x="86" y="80" class="label" font-size="25" fill="${colors.muted}">SELECTED WORK / AI SYSTEMS</text>
    <path d="M55 108H945" stroke="${colors.rule}"/>
    <text x="55" y="177" font-size="52" font-weight="700" fill="${colors.ink}">${xml(profile.identity.name)}</text>
    <text x="55" y="225" font-size="32" fill="${colors.muted}">${xml(currentRole)}</text>
    ${headline.map((line, index) => `<text x="50" y="${340 + index * 112}" class="display" font-size="96" font-weight="700" fill="${index ? colors.primary : colors.ink}">${xml(line)}</text>`).join('\n')}
    <path d="M55 500H945" stroke="${colors.rule}"/>
    <path class="signal" d="M55 500H945" stroke="${colors.secondary}" stroke-width="2" opacity=".65"/>
    <text x="55" y="539" class="label" font-size="25" fill="${colors.muted}">MODELS · TOOLS · WORKFLOWS</text>
    <circle cx="864" cy="159" r="35" fill="${colors.soft}" stroke="${colors.rule}"/>
    <path d="M843 159H885M864 138V180" stroke="${colors.secondary}" stroke-width="2"/>
    <circle cx="864" cy="159" r="7" fill="${colors.primary}"/>`);
  }

  renderLoop(profile, mode) {
    const colors = palette(mode);
    const rowHeight = 208;
    const height = 155 + rowHeight * profile.layers.length;
    return svgFrame(mode, height, `Inside ${profile.layers[0].project}: ${profile.layers.map(layer => layer.name).join(', ')}`, `
    <text x="55" y="84" class="label" font-size="36" font-weight="700" fill="${colors.ink}">INSIDE A WORKFLOW</text>
    <path d="M55 112H945" stroke="${colors.rule}"/>
    ${profile.layers.map((layer, index) => {
      const y = 187 + rowHeight * index;
      const lines = wrap(layer.description, 32);
      if (lines.length > 2 || layer.name.length > 18) throw new Error(`Workflow row ${layer.name} needs shorter copy.`);
      const accent = layer.tone === 'primary' ? colors.primary : colors.secondary;
      return `<g>
        <text x="55" y="${y}" font-size="55" class="display" font-weight="700" fill="${accent}">${String(index + 1).padStart(2, '0')}</text>
        <text x="171" y="${y}" font-size="46" font-weight="700" fill="${colors.ink}">${xml(layer.name)}</text>
        ${lines.map((line, row) => `<text x="171" y="${y + 57 + row * 49}" font-size="42" fill="${colors.muted}">${xml(line)}</text>`).join('\n')}
        <path d="M171 ${y + 135}H945" stroke="${colors.rule}"/>
        ${index < profile.layers.length - 1 ? `<path d="M85 ${y + 38}V${y + 153}" stroke="${colors.rule}" stroke-width="2"/><path d="M79 ${y + 145}L85 ${y + 153}L91 ${y + 145}" fill="none" stroke="${accent}" stroke-width="2"/>` : ''}
      </g>`;
    }).join('\n')}`);
  }
}

function picture(name, alt) {
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="assets/${name}-light.svg">
  <img alt="${xml(alt)}" src="assets/${name}-light.svg" width="100%">
</picture>`;
}

function narrativeSection(name) {
  const marker = `<!-- ${name} -->`;
  const start = narrative.indexOf(marker);
  if (start === -1) throw new Error(`Narrative section ${name} is missing.`);
  return narrative.slice(start + marker.length).split(/<!-- [A-Z_]+ -->/)[0].trim();
}

function renderReadme() {
  const contactLinks = config.links.map(link => `[${label(link.label)}](${link.url})`).join(' · ');
  const featured = config.flagships.map((project, index) => `### ${String(index + 1).padStart(2, '0')} · [${label(project.repo)}](${repositoryUrl(project.repo)})

**${label(project.role)}**

${project.description}`).join('\n\n');
  const supporting = config.module_groups.map(group => `<details>
<summary><strong>${xml(group.name)}</strong></summary>

${group.projects.map(project => `- **[${label(project.repo)}](${repositoryUrl(project.repo)})** — ${project.description}`).join('\n')}

</details>`).join('\n\n');
  return `# ${label(config.identity.name)}

**${config.identity.tagline.split('.')[0]}** · ${label(config.identity.location)}

${contactLinks}

${picture('hero', `${config.identity.name} — agentic AI engineering`)}

**Selected projects:** ${config.flagships.map(project => `[${label(project.repo)}](${repositoryUrl(project.repo)})`).join(' · ')}

${narrativeSection('CURRENT_WORK')}

## Selected work

${featured}

## Inside a workflow

In [${label(config.layers[0].project)}](${repositoryUrl(config.layers[0].project)}), specialist agents work through a concrete sequence:

${config.layers.map(layer => `1. **${label(layer.name)}** — ${layer.description}`).join('\n')}

<details>
<summary><strong>View the workflow map</strong></summary>

${picture('closed-loop', 'Instagram.AI workflow: ingest source media, analyze evidence, then draft and verify scripts and PDFs')}

</details>

${narrativeSection('FOUNDATIONS')}

## More experiments & applications

${supporting}

${narrativeSection('BACKGROUND')}

---

**Let's connect:** ${contactLinks}

<!-- Generated with Profile Control Plane from .profile/profile.yaml and .profile/narrative.md. Run npm run build in .profile; do not hand-edit README.md or assets/*.svg. -->
`;
}

const compiled = compileProfile(config, new ReadableEditorialRenderer());
const generated = {
  files: compiled.files.map(file => file.path === 'README.md' ? { ...file, content: renderReadme() } : file),
};
await checkCompiledProfile(config, generated);
for (const file of generated.files) {
  const path = resolve(repositoryDirectory, file.path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content, 'utf8');
}
console.log(`Generated ${generated.files.length} files using the editorial renderer and the validated profile schema.`);
if (process.argv.includes('--preview')) {
  const preview = await startPreviewServer(generated, 0);
  console.log(`Preview: ${preview.url} (dark), ${preview.url}/light (light)`);
}
