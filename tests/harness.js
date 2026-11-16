const tests = [];
export function test(name, run) { tests.push({ name, run }); }
export function assert(value, message = 'Условие не выполнено') { if (!value) throw new Error(message); }
export function near(actual, expected, epsilon = 1e-6) {
  assert(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
}
export function throws(run) {
  let thrown = false;
  try { run(); } catch { thrown = true; }
  assert(thrown, 'Ожидалась ошибка входных данных');
}

export function runTests() {
  const lines = [];
  let failed = 0;
  for (const { name, run } of tests) {
    try { run(); lines.push(`PASS ${name}`); }
    catch (error) { failed++; lines.push(`FAIL ${name}: ${error.message}`); }
  }
  const summary = `${tests.length - failed}/${tests.length} passed`;
  const output = [...lines, '', summary].join('\n');
  if (typeof document !== 'undefined') {
    document.querySelector('#results').textContent = output;
    document.title = `${failed ? 'FAIL' : 'PASS'} — Beam in the Dark tests`;
  }
  console.log(output);
  if (failed) throw new Error(summary);
  return { passed: tests.length, failed };
}
