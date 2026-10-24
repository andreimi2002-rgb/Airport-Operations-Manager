// JSON formatter that keeps small objects and arrays on one line,
// so data files with many gates or routes stay easy to read and diff.

const MAX = 150;

export function pretty(value) {
  return format(value, '') + '\n';
}

function flat(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(flat).join(', ') + ']';
  const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${flat(v)}`);
  return entries.length ? '{ ' + entries.join(', ') + ' }' : '{}';
}

function format(value, indent) {
  const oneLine = flat(value);
  if (value === null || typeof value !== 'object' || indent.length + oneLine.length <= MAX) return oneLine;
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    return '[\n' + value.map(v => inner + format(v, inner)).join(',\n') + '\n' + indent + ']';
  }
  const entries = Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`);
  return '{\n' + entries.join(',\n') + '\n' + indent + '}';
}
