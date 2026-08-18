// ui.js — DOM glue: wires the controls to assembler.js/cpu.js, renders the
// memory grid, registers, program listing and console, and drives the
// Run interval loop. Everything here reads/writes the CPU instance;
// assembler.js and cpu.js never touch the DOM.

const cpu = new CPU(MEMORY_SIZE);

const codeEditor = document.getElementById('codeEditor');
const programListingEl = document.getElementById('programListing');
const errorBox = document.getElementById('errorBox');
const memoryGridEl = document.getElementById('memoryGrid');
const consoleEl = document.getElementById('console');
const consoleStatus = document.getElementById('consoleStatus');

const assembleBtn = document.getElementById('assembleBtn');
const editBtn = document.getElementById('editBtn');
const stepBtn = document.getElementById('stepBtn');
const runBtn = document.getElementById('runBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const speedSlider = document.getElementById('speedSlider');

const regAcc = document.getElementById('regAcc');
const regPc = document.getElementById('regPc');
const regZ = document.getElementById('regZ');
const regAccBox = document.getElementById('regAccBox');
const regPcBox = document.getElementById('regPcBox');
const regZBox = document.getElementById('regZBox');

const memoryInputs = [];
const memoryBitRows = [];
const BITS = 8; // every memory cell and ACC are shown as one byte
let accBitRow = null;
let assembledProgram = null;
let assembledSourceLines = null;
let assembledMemorySnapshot = null;
let highlightedLi = null;
let running = false;
let runIntervalId = null;

// --------------------------------------------------------------- binary --- //
// Every memory cell and ACC are really an 8-bit byte underneath the decimal
// number — this renders that byte as a strip of lit/unlit bits, with a
// pulse animation on whichever bits just flipped.
function toBits(value) {
  const byte = ((value % 256) + 256) % 256; // two's-complement 8-bit wrap
  return byte.toString(2).padStart(BITS, '0').split('');
}

function buildBitRow(container) {
  for (let i = 0; i < BITS; i++) {
    const bit = document.createElement('span');
    bit.className = 'bit';
    container.appendChild(bit);
  }
  container._bits = null;
}

function updateBitRow(container, value) {
  if (!container) return;
  const bits = toBits(value);
  const prev = container._bits;
  bits.forEach((b, i) => {
    const el = container.children[i];
    el.textContent = b;
    el.classList.toggle('on', b === '1');
    if (prev && prev[i] !== b) {
      el.classList.remove('changed');
      void el.offsetWidth; // restart the animation even if it's still running
      el.classList.add('changed');
    }
  });
  container._bits = bits;
}

// -------------------------------------------------------------- memory --- //
function buildMemoryGrid() {
  for (let addr = 0; addr < MEMORY_SIZE; addr++) {
    const cell = document.createElement('div');
    cell.className = 'mem-cell';
    cell.id = 'mem-' + addr;

    const label = document.createElement('span');
    label.className = 'mem-addr';
    label.textContent = addr;

    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.className = 'mem-value';
    input.value = '0';
    input.addEventListener('input', () => {
      const raw = parseInt(input.value, 10);
      if (Number.isNaN(raw)) return; // mid-edit (e.g. just typed "-") — don't fight the user's typing
      const wrapped = wrapByte(raw);
      cpu.memory[addr] = wrapped;
      if (wrapped !== raw) input.value = wrapped; // snap into signed-byte range, live
      updateBitRow(memoryBitRows[addr], wrapped);
    });

    const bitRow = document.createElement('div');
    bitRow.className = 'bit-row mem-bit-row';
    buildBitRow(bitRow);

    cell.appendChild(label);
    cell.appendChild(input);
    cell.appendChild(bitRow);
    memoryGridEl.appendChild(cell);
    memoryInputs.push(input);
    memoryBitRows.push(bitRow);
    updateBitRow(bitRow, 0);
  }
}

function buildAccBitRow() {
  accBitRow = document.getElementById('regAccBits');
  buildBitRow(accBitRow);
  updateBitRow(accBitRow, 0);

  const places = document.getElementById('regAccPlaces');
  [128, 64, 32, 16, 8, 4, 2, 1].forEach((place) => {
    const label = document.createElement('span');
    label.className = 'bit-place';
    label.textContent = place;
    places.appendChild(label);
  });
}

function setAllMemoryCells(values) {
  values.forEach((v, addr) => {
    const wrapped = wrapByte(v);
    memoryInputs[addr].value = wrapped;
    cpu.memory[addr] = wrapped;
    updateBitRow(memoryBitRows[addr], wrapped);
  });
}

function readMemoryFromInputs() {
  return memoryInputs.map((input) => {
    const v = parseInt(input.value, 10);
    return wrapByte(Number.isNaN(v) ? 0 : v);
  });
}

function setMemoryEditable(editable) {
  memoryInputs.forEach((input) => { input.disabled = !editable; });
}

function flash(el) {
  if (!el) return;
  el.classList.add('flash');
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => el.classList.remove('flash'), 400);
}

// --------------------------------------------------------------- console --- //
function appendConsole(text) {
  consoleEl.textContent += text;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearConsole() {
  consoleEl.textContent = '';
  consoleStatus.textContent = '';
  consoleStatus.hidden = true;
}

// -------------------------------------------------------------- listing --- //
function renderProgramListing() {
  programListingEl.innerHTML = '';
  highlightedLi = null;
  assembledSourceLines.forEach((raw, idx) => {
    const lineNumber = idx + 1;
    const li = document.createElement('li');
    li.id = 'pline-' + lineNumber;
    li.className = assembledProgram.instructions.has(lineNumber) ? 'instr' : 'noop';
    li.setAttribute('data-line', lineNumber);
    li.textContent = raw.length ? raw : ' ';
    programListingEl.appendChild(li);
  });
}

function highlightLine(line) {
  if (highlightedLi) highlightedLi.classList.remove('pc-current');
  highlightedLi = null;
  if (line === null || line === undefined) return;
  const li = document.getElementById('pline-' + line);
  if (li) {
    li.classList.add('pc-current');
    li.scrollIntoView({ block: 'nearest' });
    highlightedLi = li;
  }
}

// ------------------------------------------------------------- registers --- //
function syncRegistersDisplay() {
  regAcc.textContent = cpu.acc;
  regPc.textContent = cpu.pc === null ? '—' : cpu.pc;
  regZ.textContent = cpu.zeroFlag ? '1' : '0';
  updateBitRow(accBitRow, cpu.acc);
}

// ---------------------------------------------------------------- errors --- //
function showErrors(errors) {
  errorBox.innerHTML = '';
  const heading = document.createElement('div');
  heading.textContent = errors.length === 1 ? 'Found 1 problem:' : `Found ${errors.length} problems:`;
  errorBox.appendChild(heading);
  const ul = document.createElement('ul');
  errors.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = e.message;
    ul.appendChild(li);
  });
  errorBox.appendChild(ul);
  errorBox.hidden = false;
}

function hideErrors() {
  errorBox.hidden = true;
  errorBox.innerHTML = '';
}

// ------------------------------------------------------------ UI states --- //
function switchToEditingState() {
  codeEditor.hidden = false;
  programListingEl.hidden = true;
  assembleBtn.hidden = false;
  editBtn.hidden = true;
  stepBtn.disabled = true;
  runBtn.disabled = true;
  resetBtn.disabled = true;
  runBtn.hidden = false;
  pauseBtn.hidden = true;
}

function switchToLoadedState() {
  codeEditor.hidden = true;
  programListingEl.hidden = false;
  assembleBtn.hidden = true;
  editBtn.hidden = false;
  stepBtn.disabled = false;
  runBtn.disabled = false;
  resetBtn.disabled = false;
  runBtn.hidden = false;
  pauseBtn.hidden = true;
}

// ------------------------------------------------------------- execution --- //
function applyEffects(effects) {
  effects.forEach((effect) => {
    switch (effect.kind) {
      case 'exec-line':
        highlightLine(effect.line);
        break;
      case 'read-mem':
        flash(document.getElementById('mem-' + effect.addr));
        break;
      case 'write-mem':
        memoryInputs[effect.addr].value = effect.value;
        updateBitRow(memoryBitRows[effect.addr], effect.value);
        flash(document.getElementById('mem-' + effect.addr));
        break;
      case 'reg-acc':
        regAcc.textContent = effect.value;
        updateBitRow(accBitRow, effect.value);
        flash(regAccBox);
        break;
      case 'reg-pc':
        regPc.textContent = effect.value === null ? '—' : effect.value;
        flash(regPcBox);
        break;
      case 'reg-z':
        regZ.textContent = effect.value ? '1' : '0';
        flash(regZBox);
        break;
      case 'output':
        appendConsole(effect.text);
        break;
      default:
        break;
    }
  });
}

function handleHaltedIfNeeded() {
  if (!cpu.halted) return;
  stopRun();
  consoleStatus.textContent = 'Program finished.';
  consoleStatus.hidden = false;
}

function doStep() {
  if (!assembledProgram || cpu.halted) return;
  setMemoryEditable(false);
  const { effects } = cpu.step();
  applyEffects(effects);
  handleHaltedIfNeeded();
}

function startRun() {
  if (!assembledProgram || cpu.halted || running) return;
  running = true;
  setMemoryEditable(false);
  runBtn.hidden = true;
  pauseBtn.hidden = false;
  stepBtn.disabled = true;
  const speed = Number(speedSlider.value) || 4;
  runIntervalId = setInterval(() => {
    if (!assembledProgram || cpu.halted) { stopRun(); return; }
    const { effects } = cpu.step();
    applyEffects(effects);
    handleHaltedIfNeeded();
  }, 1000 / speed);
}

function stopRun() {
  if (runIntervalId) {
    clearInterval(runIntervalId);
    runIntervalId = null;
  }
  running = false;
  runBtn.hidden = false;
  pauseBtn.hidden = true;
  if (assembledProgram) {
    stepBtn.disabled = cpu.halted;
    runBtn.disabled = cpu.halted;
  }
}

// ----------------------------------------------------------- top actions --- //
function doAssemble() {
  stopRun();
  hideErrors();
  const result = assemble(codeEditor.value);
  if (!result.ok) {
    showErrors(result.errors);
    switchToEditingState();
    return;
  }

  assembledProgram = result.program;
  assembledSourceLines = result.sourceLines;
  assembledMemorySnapshot = readMemoryFromInputs();
  cpu.load(assembledProgram, assembledMemorySnapshot);

  renderProgramListing();
  clearConsole();
  setMemoryEditable(true);
  syncRegistersDisplay();
  highlightLine(cpu.pc);
  switchToLoadedState();
}

function doReset() {
  if (!assembledProgram) return;
  stopRun();
  cpu.load(assembledProgram, assembledMemorySnapshot);
  setAllMemoryCells(assembledMemorySnapshot);
  setMemoryEditable(true);
  clearConsole();
  syncRegistersDisplay();
  highlightLine(cpu.pc);
  stepBtn.disabled = false;
  runBtn.disabled = false;
  runBtn.hidden = false;
  pauseBtn.hidden = true;
}

function doEdit() {
  stopRun();
  switchToEditingState();
  setMemoryEditable(true);
}

function doLoadExample(key) {
  const example = EXAMPLES[key];
  if (!example) return;
  stopRun();
  const mem = new Array(MEMORY_SIZE).fill(0);
  Object.keys(example.memory).forEach((addr) => { mem[Number(addr)] = example.memory[addr]; });
  setAllMemoryCells(mem);
  codeEditor.value = example.code;
  doAssemble();
}

// -------------------------------------------------------------- wire up --- //
buildMemoryGrid();
buildAccBitRow();

document.querySelectorAll('[data-example]').forEach((btn) => {
  btn.addEventListener('click', () => doLoadExample(btn.getAttribute('data-example')));
});

assembleBtn.addEventListener('click', doAssemble);
editBtn.addEventListener('click', doEdit);
stepBtn.addEventListener('click', doStep);
runBtn.addEventListener('click', startRun);
pauseBtn.addEventListener('click', stopRun);
resetBtn.addEventListener('click', doReset);

speedSlider.addEventListener('input', () => {
  if (running) { stopRun(); startRun(); }
});

switchToEditingState();
doLoadExample('hello');
