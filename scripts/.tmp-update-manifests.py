import json
from collections import OrderedDict


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def dump(path, data):
    with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def set_after(d, anchor, key, value):
    """Insert key after anchor preserving order."""
    if key in d:
        d[key] = value
        return d
    out = OrderedDict()
    for k, v in d.items():
        out[k] = v
        if k == anchor:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


# ---------------- root ----------------
root = load('package.json')
deps = root['dependencies']
deps['@next/bundle-analyzer'] = '^16.4.2'
deps = set_after(deps, '@next/bundle-analyzer', '@prisma/adapter-better-sqlite3', '^7.10.1')
deps['exceljs'] = '^4.4.0'
deps['next'] = '^16.4.2'
deps = set_after(deps, 'next', 'prisma', '^7.10.1')
deps = set_after(deps, 'react-dom', 'tsx', '^4.23.13')
root['dependencies'] = deps

dev = root['devDependencies']
for gone in ('prisma', 'tsx', 'ts-jest'):
    dev.pop(gone, None)
dev['jest'] = '^30.5.2'
dev['@storybook/addon-themes'] = '^10.6.2'
dev['@storybook/nextjs'] = '^10.6.2'
dev['@storybook/react'] = '^10.6.2'
dev['storybook'] = '^10.6.2'
root['devDependencies'] = dev

scripts = root['allowScripts']
scripts['better-sqlite3@12.11.1'] = True
root['allowScripts'] = scripts
dump('package.json', root)

# ---------------- core ----------------
core = load('core/package.json')
cdeps = core['dependencies']
cdeps['@prisma/adapter-better-sqlite3'] = '^7.10.1'
cdeps['@prisma/client'] = '^7.10.1'
cdeps['next'] = '^16.4.2'
cdeps = OrderedDict((k, v) for k, v in cdeps.items() if k != 'next')
cdeps = set_after(cdeps, 'next', 'prisma', '^7.10.1')
cdeps = set_after(cdeps, 'react-dom', 'tsx', '^4.23.13')
core['dependencies'] = OrderedDict(sorted(cdeps.items(), key=lambda kv: kv[0]))

cdev = core['devDependencies']
for gone in ('prisma', 'tsx'):
    cdev.pop(gone, None)
core['devDependencies'] = cdev
core['allowScripts'] = OrderedDict([
    ('better-sqlite3@12.11.1', True),
    ('esbuild@0.28.2', True),
])
dump('core/package.json', core)

print('root deps:', len(root['dependencies']), 'dev:', len(root['devDependencies']))
print('core deps:', len(core['dependencies']), 'dev:', len(core['devDependencies']))
