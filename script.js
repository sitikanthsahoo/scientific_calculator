// Smart Calculator - Core scaffold with core arithmetic, history, memory, scientific, solver, conversions, finance, stats, and graphing

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const round = (num, places = 12) => {
  if (!isFinite(num)) return num;
  const p = Math.pow(10, places);
  return Math.round((num + Number.EPSILON) * p) / p;
};

const factorial = (n) => {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= Math.floor(n); i++) result *= i;
  return result;
};

const nPr = (n, r) => factorial(n) / factorial(n - r);
const nCr = (n, r) => factorial(n) / (factorial(r) * factorial(n - r));

// Degree/Radian
let useDegrees = true;
const toRadians = (x) => (useDegrees ? (x * Math.PI) / 180 : x);
const fromRadians = (x) => (useDegrees ? (x * 180) / Math.PI : x);

// Memory and History
let memoryValue = 0;
let lastAnswer = 0;
const history = [];

function pushHistory(expression, value) {
  const item = { expression, value, time: new Date() };
  history.unshift(item);
  renderHistory();
}

function renderHistory() {
  const list = $('#history-list');
  list.innerHTML = '';
  history.slice(0, 50).forEach((h, idx) => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.textContent = `${h.expression} = ${h.value}`;
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => navigator.clipboard.writeText(`${h.value}`));
    right.appendChild(btn);
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// ---------- Expression Parser/Evaluator ----------
// We convert a user expression into a safe JavaScript expression
// Supported: + - * / % ^, parentheses, functions, factorial !, nCr, nPr, Ans

function preprocessExpression(input) {
  let expr = input.trim();
  if (!expr) return '';

  // Replace unicode operators and tokens
  expr = expr
    .replace(/[×x]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/−/g, '-')
    .replace(/\^/g, '**')
    .replace(/Ans/g, String(lastAnswer));

  // Factorial: transform patterns like 5! or (2+3)! to fact(5) or fact((2+3))
  expr = expr.replace(/(\)\s*!|\d+(?:\.\d+)?\s*!)/g, (match) => {
    // This regex matches either ") !" or "number!"; we will handle with a second pass
    return match; // placeholder; we will process with a more robust pass below
  });

  // Robust factorial handling using a loop
  while (/([\)\d\.]+)\s*!/.test(expr)) {
    expr = expr.replace(/([\)\d\.]+)\s*!/g, (m, a) => `fact(${a})`);
  }

  // nCr and nPr: allow either `nCr(r)` style in UI mapping, but also detect pattern a C b or a P b
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*[cC]\s*(\d+(?:\.\d+)?)/g, (m, n, r) => `nCr(${n},${r})`);
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*[pP]\s*(\d+(?:\.\d+)?)/g, (m, n, r) => `nPr(${n},${r})`);

  // Implicit multiplication: e.g., 2(3+1) -> 2*(3+1), )2 -> )*2, number function like 2sin(x) -> 2*sin(x)
  expr = expr
    .replace(/(\d|\))\s*\(/g, '$1*(')
    .replace(/(\))\s*(\d|[a-zA-Z])/g, '$1*$2')
    // number immediately before x: 2x -> 2*x
    .replace(/(\d+(?:\.\d+)?)\s*x\b/g, '$1*x')
    // number immediately before function: 2sin -> 2*sin
    .replace(/(\d+(?:\.\d+)?)\s*(sin|cos|tan|asin|acos|atan|log|ln|sqrt|exp)\b/g, '$1*$2')
    // x immediately before ( : x( -> x*(
    .replace(/x\s*\(/g, 'x*(');

  // We will use helper functions via scope, so no replacement needed for function names

  // Percentage: a% -> (a/100)
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  return expr;
}

function toRadiansWrap(x) { return `(${x})*(useDegrees?Math.PI/180:1)`; }
function fromRadiansWrap(x) { return `(useDegrees?(${x})*180/Math.PI:(${x}))`; }

function evaluateExpression(rawInput) {
  const expr = preprocessExpression(rawInput);
  if (!expr) return '';
  try {
    // Build a safe function scope with math helpers
    const trig = (f) => (x) => Math[f](useDegrees ? (x * Math.PI) / 180 : x);
    const atrig = (f) => (x) => useDegrees ? (Math[f](x) * 180) / Math.PI : Math[f](x);
    const scope = {
      Math,
      fact: factorial, nCr, nPr, useDegrees,
      sin: trig('sin'), cos: trig('cos'), tan: trig('tan'),
      asin: atrig('asin'), acos: atrig('acos'), atan: atrig('atan'),
      log: (x) => Math.log10(x), ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x), exp: (x) => Math.exp(x)
    };
    const fn = new Function('scope', `with(scope){ return (${expr}); }`);
    const val = fn(scope);
    return round(val);
  } catch (e) {
    return 'Error';
  }
}

// ---------- UI Wiring ----------
const input = $('#calc-input');
const result = $('#calc-result');

function insertText(text) {
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const v = input.value;
  input.value = v.slice(0, start) + text + v.slice(end);
  const pos = start + text.length;
  input.selectionStart = input.selectionEnd = pos;
  input.focus();
  liveEvaluate();
}

function liveEvaluate() {
  const val = evaluateExpression(input.value);
  result.textContent = val === '' ? '0' : val;
}

input.addEventListener('input', liveEvaluate);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    onEquals();
  }
  if (e.key === 'Backspace') {
    // default behavior ok, then live evaluate
    setTimeout(liveEvaluate, 0);
  }
});

$$('.keypad [data-insert]').forEach((btn) => {
  btn.addEventListener('click', () => insertText(btn.getAttribute('data-insert')));
});

$$('.keypad [data-fn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.getAttribute('data-fn');
    if (name === 'fact') return insertText('!');
    if (name === 'nCr') return insertText('C');
    if (name === 'nPr') return insertText('P');
    insertText(`${name}(`);
  });
});

$$('.keypad [data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-action');
    switch (action) {
      case 'clear':
        input.value = '';
        liveEvaluate();
        break;
      case 'back': {
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        if (start !== end) {
          input.value = input.value.slice(0, start) + input.value.slice(end);
          input.selectionStart = input.selectionEnd = start;
        } else if (start > 0) {
          input.value = input.value.slice(0, start - 1) + input.value.slice(start);
          input.selectionStart = input.selectionEnd = start - 1;
        }
        input.focus();
        liveEvaluate();
        break;
      }
      case 'equals':
        onEquals();
        break;
      case 'mc':
        memoryValue = 0; break;
      case 'mr':
        insertText(String(memoryValue)); break;
      case 'm+': {
        const v = Number(evaluateExpression(input.value));
        if (!isNaN(v)) memoryValue += v; break;
      }
      case 'm-': {
        const v = Number(evaluateExpression(input.value));
        if (!isNaN(v)) memoryValue -= v; break;
      }
      case 'ans':
        insertText(String(lastAnswer)); break;
      case 'copy':
        navigator.clipboard.writeText(String(result.textContent)); break;
    }
  });
});

function onEquals() {
  const expr = input.value.trim();
  const val = evaluateExpression(expr);
  if (val !== 'Error' && expr) {
    lastAnswer = Number(val);
    pushHistory(expr, val);
  }
  result.textContent = val;
}

// Deg/Rad toggle
const degRadToggle = $('#degRadToggle');
const degRadLabel = $('#degRadLabel');
degRadToggle.addEventListener('change', () => {
  useDegrees = !degRadToggle.checked; // unchecked: DEG, checked: RAD
  degRadLabel.textContent = useDegrees ? 'DEG' : 'RAD';
  liveEvaluate();
});

// ---------- Tabs ----------
const tabs = $$('.tab');
const panels = $$('.panel');
tabs.forEach((t) => t.addEventListener('click', () => {
  tabs.forEach((x) => x.classList.remove('active'));
  panels.forEach((p) => p.classList.remove('active'));
  t.classList.add('active');
  const id = t.getAttribute('data-tab');
  $(`#panel-${id}`).classList.add('active');
}));

// ---------- Solver ----------
$('#solve-linear').addEventListener('click', () => {
  const a = Number($('#lin-a').value);
  const b = Number($('#lin-b').value);
  const c = Number($('#lin-c').value);
  const steps = [];
  steps.push(`Given: ${a}x + ${b} = ${c}`);
  steps.push(`${a}x = ${c} - ${b} = ${c - b}`);
  const rhs = c - b;
  steps.push(`x = (${rhs}) / ${a}`);
  const x = rhs / a;
  steps.push(`x = ${round(x)}`);
  $('#linear-steps').textContent = steps.join('\n');
});

$('#solve-quadratic').addEventListener('click', () => {
  const a = Number($('#quad-a').value);
  const b = Number($('#quad-b').value);
  const c = Number($('#quad-c').value);
  const steps = [];
  steps.push(`Given: ${a}x^2 + ${b}x + ${c} = 0`);
  steps.push('Using quadratic formula: x = (-b ± √(b² - 4ac)) / (2a)');
  const disc = b*b - 4*a*c;
  steps.push(`Discriminant Δ = b² - 4ac = ${b*b} - ${4*a*c} = ${disc}`);
  if (disc < 0) {
    steps.push('No real roots');
  } else {
    const sqrtD = Math.sqrt(disc);
    steps.push(`√Δ = ${sqrtD}`);
    const x1 = (-b + sqrtD) / (2*a);
    const x2 = (-b - sqrtD) / (2*a);
    steps.push(`x1 = ${round(x1)}, x2 = ${round(x2)}`);
  }
  $('#quadratic-steps').textContent = steps.join('\n');
});

// ---------- Converter ----------
const unitSets = {
  length: {
    base: 'm',
    units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.34, ft: 0.3048, in: 0.0254 }
  },
  weight: {
    base: 'kg',
    units: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 }
  },
  time: {
    base: 's',
    units: { s: 1, min: 60, hr: 3600, day: 86400 }
  },
  temp: {
    // Special handling
    base: 'C', units: { C: 'C', F: 'F', K: 'K' }
  }
};

const currencyState = { symbols: ['USD','EUR','GBP','JPY','INR'], rates: null, base: 'USD' };

function populateConverter(type) {
  const from = $('#conv-from');
  const to = $('#conv-to');
  from.innerHTML = '';
  to.innerHTML = '';
  if (type === 'currency') {
    currencyState.symbols.forEach((s) => {
      from.add(new Option(s, s));
      to.add(new Option(s, s));
    });
    from.value = 'USD';
    to.value = 'EUR';
  } else if (type === 'temp') {
    ['C','F','K'].forEach((u) => { from.add(new Option(u, u)); to.add(new Option(u, u)); });
    from.value = 'C'; to.value = 'F';
  } else {
    const units = Object.keys(unitSets[type].units);
    units.forEach((u) => { from.add(new Option(u, u)); to.add(new Option(u, u)); });
    from.selectedIndex = 0; to.selectedIndex = 1;
  }
}

$('#conv-type').addEventListener('change', (e) => populateConverter(e.target.value));
populateConverter($('#conv-type').value);

async function fetchRates() {
  try {
    // Free API example (no key): https://open.er-api.com/v6/latest/USD
    const base = currencyState.base;
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();
    if (data && data.result === 'success') {
      currencyState.rates = data.rates;
    }
  } catch (e) { /* ignore */ }
}
fetchRates();

function convertTemp(value, from, to) {
  let c;
  if (from === 'C') c = value;
  else if (from === 'F') c = (value - 32) * 5/9;
  else if (from === 'K') c = value - 273.15;
  let out = c;
  if (to === 'C') out = c;
  else if (to === 'F') out = c * 9/5 + 32;
  else if (to === 'K') out = c + 273.15;
  return out;
}

$('#convert').addEventListener('click', async () => {
  const type = $('#conv-type').value;
  const value = Number($('#conv-value').value);
  const from = $('#conv-from').value;
  const to = $('#conv-to').value;
  let out = NaN;
  if (type === 'currency') {
    if (!currencyState.rates) await fetchRates();
    const rates = currencyState.rates || {};
    const base = currencyState.base;
    // Convert from -> base -> to
    if (from === base) {
      out = value * (rates[to] || NaN);
    } else if (to === base) {
      out = value / (rates[from] || NaN);
    } else {
      out = value / (rates[from] || NaN) * (rates[to] || NaN);
    }
  } else if (type === 'temp') {
    out = convertTemp(value, from, to);
  } else {
    const set = unitSets[type];
    const toBase = value * set.units[from];
    out = toBase / set.units[to];
  }
  $('#conv-result').textContent = isFinite(out) ? String(round(out)) : '—';
});

// ---------- Finance ----------
$('#calc-emi').addEventListener('click', () => {
  const P = Number($('#loan-principal').value);
  const rAnnual = Number($('#loan-rate').value) / 100;
  const n = Number($('#loan-term').value);
  const i = rAnnual / 12;
  if (i === 0) {
    const emi = P / n;
    $('#emi-result').textContent = `EMI = ${round(emi)}`;
    return;
  }
  const emi = P * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
  $('#emi-result').textContent = `EMI = ${round(emi)}`;
});

// ---------- Statistics ----------
function parseNumbers(str) {
  return str.split(/[,\s]+/).map(Number).filter((x) => !isNaN(x));
}

function statsSummary(arr) {
  const n = arr.length;
  const mean = arr.reduce((a,b)=>a+b,0)/n;
  const sorted = [...arr].sort((a,b)=>a-b);
  const median = n%2? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
  const variance = arr.reduce((a,b)=>a + Math.pow(b-mean,2),0)/n;
  const std = Math.sqrt(variance);
  return { n, mean: round(mean), median: round(median), variance: round(variance), std: round(std) };
}

$('.stats-actions [data-stats="summary"]').addEventListener('click', () => {
  const arr = parseNumbers($('#stats-input').value);
  const s = statsSummary(arr);
  $('#stats-output').textContent = `n=${s.n}\nmean=${s.mean}\nmedian=${s.median}\nvariance=${s.variance}\nstd=${s.std}`;
});

$('.stats-actions [data-stats="permutations"]').addEventListener('click', () => {
  const n = Number($('#stats-n').value); const r = Number($('#stats-r').value);
  $('#stats-output').textContent = `nPr = ${nPr(n,r)}`;
});

$('.stats-actions [data-stats="combinations"]').addEventListener('click', () => {
  const n = Number($('#stats-n').value); const r = Number($('#stats-r').value);
  $('#stats-output').textContent = `nCr = ${nCr(n,r)}`;
});

// ---------- Graphing ----------
const canvas = $('#graph-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvasForDPR() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function parseFunction(expr) {
  // Replace x with a parameter and build evaluator
  const e = preprocessExpression(expr.replace(/\bx\b/g, '(x)'));
  const trig = (f) => (x) => Math[f](useDegrees ? (x * Math.PI) / 180 : x);
  const atrig = (f) => (x) => useDegrees ? (Math[f](x) * 180) / Math.PI : Math[f](x);
  const scope = {
    Math,
    fact: factorial, nCr, nPr, useDegrees,
    sin: trig('sin'), cos: trig('cos'), tan: trig('tan'),
    asin: atrig('asin'), acos: atrig('acos'), atan: atrig('atan'),
    log: (x) => Math.log10(x), ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x), exp: (x) => Math.exp(x)
  };
  const fn = new Function('x','scope', `with(scope){ return (${e}); }`);
  return (x) => {
    try { return Number(fn(x, scope)); } catch { return NaN; }
  };
}

function niceStep(range) {
  const raw = range / 10;
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, raw))));
  const n = raw / pow10;
  let step;
  if (n < 1.5) step = 1; else if (n < 3) step = 2; else if (n < 7) step = 5; else step = 10;
  return step * pow10;
}

function drawGridAndAxes(xmin, xmax, ymin, ymax, width, height) {
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0,0,width,height);

  const xRange = xmax - xmin;
  const yRange = ymax - ymin;
  const xStep = niceStep(xRange);
  const yStep = niceStep(yRange);

  ctx.lineWidth = 1;
  // Minor grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  const xMinor = xStep / 5;
  const yMinor = yStep / 5;
  for (let x = Math.ceil(xmin / xMinor) * xMinor; x <= xmax; x += xMinor) {
    const px = ((x - xmin) / xRange) * width;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
  }
  for (let y = Math.ceil(ymin / yMinor) * yMinor; y <= ymax; y += yMinor) {
    const py = height - ((y - ymin) / yRange) * height;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
  }

  // Major grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax; x += xStep) {
    const px = ((x - xmin) / xRange) * width;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
  }
  for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax; y += yStep) {
    const py = height - ((y - ymin) / yRange) * height;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  const x0 = (-xmin) / xRange * width;
  const y0 = (ymax) / yRange * height;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(width, y0); ctx.stroke();

  // Labels
  ctx.fillStyle = 'rgba(229,231,235,0.85)';
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax; x += xStep) {
    const px = ((x - xmin) / xRange) * width;
    ctx.fillText(String(round(x, 6)), px, y0 + 4);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax; y += yStep) {
    const py = height - ((y - ymin) / yRange) * height;
    ctx.fillText(String(round(y, 6)), x0 - 4, py);
  }
}

function plotFunction() {
  const raw = $('#graph-exp').value || 'x^2 + 2x + 1';
  const xmin = Number($('#graph-xmin').value);
  const xmax = Number($('#graph-xmax').value);
  const ymin = Number($('#graph-ymin').value);
  const ymax = Number($('#graph-ymax').value);

  // fit canvas to CSS size and DPR
  resizeCanvasForDPR();
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  drawGridAndAxes(xmin, xmax, ymin, ymax, width, height);

  const colors = ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#ef4444'];
  const exprs = raw.split(/\s*,\s*/).filter(Boolean);

  exprs.forEach((expr, idx) => {
    const f = parseFunction(expr);
    const color = colors[idx % colors.length];

    // --- 1. Draw the Continuous Line (Robust Logic) ---
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    let started = false;
    
    for (let i = 0; i <= width; i++) {
      const x = xmin + (i/width)*(xmax-xmin);
      let y = f(x);

      if (!isFinite(y)) {
        started = false;
        continue;
      }

      const clampedY = Math.max(ymin, Math.min(ymax, y));
      const py = height - ((clampedY - ymin)/(ymax-ymin))*height;
      const isVisible = (y >= ymin) && (y <= ymax);

      if (!isVisible) {
          if (started) {
              ctx.lineTo(i, py);
              ctx.stroke(); // Finalize the segment at the edge
          }
          started = false;
          continue;
      }

      if (!started) {
          ctx.beginPath(); // Start a new path (crucial for clean line segments)
          ctx.moveTo(i, py);
          started = true;
      } else {
          ctx.lineTo(i, py);
      }
    }
    // Final stroke to draw the last segment
    ctx.stroke();

    // --- 2. Draw Sample Points (The Dots) ---
    ctx.fillStyle = color;
    const step = Math.floor(width / 20); // Draw roughly 20 points across the width

    if (step > 0) {
        for (let i = 0; i <= width; i += step) {
            const x = xmin + (i/width)*(xmax-xmin);
            let y = f(x);

            // Only draw the dot if the y value is defined and within the visible range
            if (isFinite(y) && y >= ymin && y <= ymax) {
                const py = height - ((y - ymin)/(ymax-ymin))*height;

                ctx.beginPath();
                ctx.arc(i, py, 3, 0, Math.PI * 2); // Radius 3 dot
                ctx.fill();
            }
        }
    }
  }); // End of exprs.forEach

  // Legend
  if (exprs.length) {
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    let y = 8;
    exprs.forEach((expr, idx) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(8, y, 10, 10);
      ctx.fillStyle = 'rgba(229,231,235,0.9)';
      ctx.fillText(expr, 24, y + 1);
      y += 16;
    });
  }
}

$('#plot').addEventListener('click', plotFunction);
$('#graph-exp').addEventListener('keydown', (e) => { if (e.key === 'Enter') plotFunction(); });
$('#graph-xmin').addEventListener('keydown', (e) => { if (e.key === 'Enter') plotFunction(); });
$('#graph-xmax').addEventListener('keydown', (e) => { if (e.key === 'Enter') plotFunction(); });
$('#graph-ymin').addEventListener('keydown', (e) => { if (e.key === 'Enter') plotFunction(); });
$('#graph-ymax').addEventListener('keydown', (e) => { if (e.key === 'Enter') plotFunction(); });

// Initial state
liveEvaluate();
resizeCanvasForDPR();
plotFunction();

window.addEventListener('resize', () => {
  resizeCanvasForDPR();
  plotFunction();
});