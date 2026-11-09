"""Static packaging checks. Does not call GitHub or execute PowerShell."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
about = json.loads((root / 'scripts/repository-about.json').read_text(encoding='utf-8'))
assert len(about['description']) < 350
assert len(about['topics']) >= 5
assert len(about['topics']) == len(set(about['topics']))
assert all(re.fullmatch(r'[a-z0-9-]+', tag) for tag in about['topics'])
cmd = (root / 'publish.cmd').read_text(encoding='utf-8')
ps = (root / 'scripts/publish.ps1').read_text(encoding='utf-8')
readme = (root / 'README.md').read_text(encoding='utf-8')
assert 'powershell.exe -NoProfile' in cmd
assert '%*' in cmd
for snippet in ('gh', 'repo', 'create', 'git', 'push', '--add-topic', 'build_type=workflow', 'Confirm', 'origin', 'repository-about.json'):
    assert snippet in ps, f'Publisher missing {snippet}'
assert 'push --force' not in ps and "@('push','--force'" not in ps
assert 'publish.cmd my-auto-clicker' in readme
assert 'scripts/repository-about.json' in readme
assert 'ABOUT.md' in readme
assert (root / 'docs/repository-social-preview.png').is_file()

# Nested parent Git repositories must not accidentally become the upload target.
for snippet in ("Join-Path $projectRoot '.git'", "'ls-files'", "'rev-parse','--show-toplevel'", "Run 'git' @('init')", "if ($actualRoot -ine $projectRoot)"):
    assert snippet in ps, f'Missing nested-repository safety: {snippet}'

print('PASS: CMD publishing package, About metadata, nested Git protection, no force push')
