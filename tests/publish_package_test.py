"""Static checks for Windows CMD publishing package (no GitHub access)."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
about = json.loads((root / 'scripts/repository-about.json').read_text(encoding='utf-8'))
assert len(about['description']) < 350
assert len(about['topics']) >= 5
assert len(about['topics']) == len(set(about['topics']))
assert all(re.fullmatch(r'[a-z0-9-]+', tag) for tag in about['topics'])
boot = (root / 'github-bootstrap.cmd').read_text(encoding='utf-8')
update = (root / 'github-update.cmd').read_text(encoding='utf-8')
sync = (root / 'git-safe-sync.cmd').read_text(encoding='utf-8')
readme = (root / 'README.md').read_text(encoding='utf-8')
for snippet in ('git init -b main','rev-parse --show-toplevel','gh repo create','gh repo edit','--add-topic','build_type=workflow','git-safe-sync.cmd','git add -A','git commit','choice /c YN'):
    assert snippet in boot, f'Bootstrap missing {snippet}'
for snippet in ('if not exist ".git"','git remote get-url origin','github-bootstrap.cmd'):
    assert snippet in update, f'Update missing {snippet}'
for snippet in ('merge-base','git push -u origin main','git fetch --no-tags origin main','git merge --ff-only'):
    assert snippet in sync, f'Safe sync missing {snippet}'
assert 'push --force' not in boot+update+sync
assert 'git reset --hard' not in boot+update+sync
assert (root / 'publish.cmd').is_file()
assert 'github-bootstrap.cmd' in readme and 'github-update.cmd' in readme
assert 'ABOUT.md' in readme
assert (root / 'docs/repository-social-preview.png').is_file()
print('PASS: user-style CMD bootstrap and safe-sync package checks')
