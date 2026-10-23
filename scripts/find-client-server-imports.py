# -*- coding: utf-8 -*-
"""فهرست کامپوننت‌های کلاینت که ثابت‌ها را by-value از lib سروری می‌گیرند."""
import glob
import io
import re

libs = set()
for p in glob.glob('lib/**/*.ts', recursive=True):
    s = io.open(p, encoding='utf-8').read()
    if re.search(r"from '\./db'|from \"\./db\"|from '@/lib/db'", s):
        libs.add(p.replace('\\', '/'))

changed = True
while changed:
    changed = False
    for p in glob.glob('lib/**/*.ts', recursive=True):
        rp = p.replace('\\', '/')
        if rp in libs:
            continue
        s = io.open(p, encoding='utf-8').read()
        for m in re.findall(r"from '\./([\w-]+)'", s):
            if 'lib/%s.ts' % m in libs:
                libs.add(rp)
                changed = True
                break

bad = []
for p in glob.glob('components/**/*.tsx', recursive=True):
    s = io.open(p, encoding='utf-8').read()
    if not s.lstrip().startswith("'use client'"):
        continue
    for m in re.findall(r"import\s*\{([^}]*)\}\s*from '@/lib/([\w-]+)';", s, re.S):
        names, lib = m[0], 'lib/%s.ts' % m[1]
        if lib not in libs:
            continue
        val = []
        for n in m[1].split(','):
            n = n.strip()
            if not n or n.startswith('type '):
                continue
            val.append(n.split(':')[0].strip())
        if val:
            bad.append((p.replace('\\', '/'), m[1], val))

for b in bad:
    print(b)
print('TOTAL', len(bad))
