import json, pathlib, sys
raw = pathlib.Path('scripts/audit_raw.json').read_text(encoding='utf-8-sig').lstrip('\ufeff')
d = json.loads(raw)
vulns = d.get('vulnerabilities', {})
order = ['critical','high','moderate','low','info']
def sev_rank(item):
    s = item[1].get('severity','low')
    return order.index(s) if s in order else 9
for k, v in sorted(vulns.items(), key=sev_rank):
    sev = v.get('severity','?').upper()
    via = v.get('via', [])
    via_names = [x.get('title', x) if isinstance(x, dict) else str(x) for x in via]
    fix = v.get('fixAvailable')
    dev_only = v.get('dev', False)
    print(sev + "  " + k + "  dev=" + str(dev_only) + "  fix=" + str(fix) + "  via=" + str(via_names[:3]))
print("---")
print("metadata:", json.dumps(d.get('metadata',{}).get('vulnerabilities',{})))
