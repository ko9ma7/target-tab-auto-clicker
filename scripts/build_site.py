#!/usr/bin/env python3
"""Build self-contained GitHub Pages docs + installable Chrome extension ZIP.

Python standard library only. Usage:
  python scripts/build_site.py --repository USERNAME/REPO
  python scripts/build_site.py --base-url https://example.com/
"""
import argparse
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
VERSION = MANIFEST['version']
ZIP_NAME = f'target-tab-auto-clicker-v{VERSION}.zip'
RUNTIME_FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'README.md', 'LICENSE']
RUNTIME_FILES += [p.relative_to(ROOT).as_posix() for p in sorted((ROOT / 'icons').glob('*')) if p.is_file()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', default=os.getenv('GITHUB_REPOSITORY', ''), help='GitHub OWNER/REPO')
    parser.add_argument('--base-url', default=os.getenv('PAGES_BASE_URL',''), help='Pages site URL (optional for custom domains)')
    parser.add_argument('--out-dir', default=str(ROOT / 'dist'))
    args = parser.parse_args()

    repo = args.repository.strip().strip('/')
    if repo and not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        parser.error('Expected --repository OWNER/REPO')
    owner, name = repo.split('/') if repo else ('', '')
    repo_url = f'https://github.com/{repo}' if repo else ''
    site_url = args.base_url.rstrip('/') + '/' if args.base_url else (f'https://{owner}.github.io/' if name.lower() == f'{owner}.github.io'.lower() else f'https://{owner}.github.io/{name}/') if repo else 'http://localhost:8000/'
    out = Path(args.out_dir).resolve()
    site = out / 'site'
    if out == ROOT or out == ROOT / 'docs':
        parser.error('Output directory cannot be the repository or docs root')
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(ROOT / 'docs', site)
    downloads = site / 'downloads'
    downloads.mkdir(exist_ok=True)
    extension_zip = downloads / ZIP_NAME
    with zipfile.ZipFile(extension_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name_ in RUNTIME_FILES:
            file = ROOT / name_
            if not file.is_file():
                raise FileNotFoundError(f'Missing runtime file: {file}')
            archive.write(file, name_)
    # Same release zip outside the site as well, useful for a GitHub Release asset.
    shutil.copy2(extension_zip, out / ZIP_NAME)
    source_text = (site / 'index.html').read_text(encoding='utf-8')
    replacements = {
        '__SITE_URL__': site_url,
        '__REPO_URL__': repo_url or '#source',
        '__ZIP_NAME__': ZIP_NAME,
    }
    for before, after in replacements.items():
        source_text = source_text.replace(before, after)
    (site / 'index.html').write_text(source_text, encoding='utf-8')
    (site / '404.html').write_text((site / '404.html').read_text(encoding='utf-8').replace('__SITE_URL__',site_url),encoding='utf-8')
    (site / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+site_url+'sitemap.xml\n', encoding='utf-8')
    (site / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+site_url+'</loc></url></urlset>\n',encoding='utf-8')
    # Ensure links and generated files exist in the artifact (no placeholder repo URLs in published builds).
    for asset in ('assets/popup-preview.png','favicon.svg','favicon-32.png','apple-touch-icon.png','og-image.png','repository-social-preview.png', f'downloads/{ZIP_NAME}'):
        assert (site / asset).is_file(), asset
    assert '__SITE_URL__' not in source_text and '__ZIP_NAME__' not in source_text
    with zipfile.ZipFile(extension_zip) as archive:
        assert archive.testzip() is None
        assert 'manifest.json' in archive.namelist()
        assert not any(name.startswith('tests/') or name.startswith('docs/') for name in archive.namelist())
    print(f'Pages site: {site}\nSite URL: {site_url}\nSource: {repo_url or "not configured (local preview)"}\nChrome extension: {extension_zip}')

if __name__ == '__main__':
    main()
