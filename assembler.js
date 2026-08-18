// assembler.js — parses EduCPU-8 source text into a program the CPU can run.
// Everything that can be checked statically (bad opcodes, bad operands,
// out-of-range addresses, jump targets that don't exist) is caught here at
// assemble time, so Step/Run never has to fail mid-program.

const OPS_NO_OPERAND = new Set(['OUT', 'OUTC', 'HALT']);
const OPS_ADDR_OR_IMMEDIATE = new Set(['LOAD', 'ADD', 'SUB']);
const OPS_ADDR_ONLY = new Set(['STORE']);
const OPS_LINE = new Set(['JMP', 'JZ']);
const ALL_OPS = new Set([...OPS_NO_OPERAND, ...OPS_ADDR_OR_IMMEDIATE, ...OPS_ADDR_ONLY, ...OPS_LINE]);

// mode: 'addr-or-imm' | 'addr' | 'line'
function parseOperand(raw, lineNumber, mode) {
  const charImm = raw.match(/^#'(.)'$/);
  const numImm = raw.match(/^#(-?\d+)$/);

  if (charImm || numImm) {
    if (mode !== 'addr-or-imm') {
      const hint = mode === 'line' ? 'a line number' : 'a memory address';
      return { error: `Line ${lineNumber}: this instruction needs ${hint}, not a # value.` };
    }
    const value = charImm ? charImm[1].charCodeAt(0) : parseInt(numImm[1], 10);
    return { operand: { mode: 'immediate', value } };
  }

  const num = raw.match(/^(-?\d+)$/);
  if (!num) return { error: `Line ${lineNumber}: "${raw}" isn't a valid operand.` };
  const value = parseInt(num[1], 10);

  if (mode === 'line') return { operand: { mode: 'line', value } };

  if (value < 0 || value > 15) {
    return { error: `Line ${lineNumber}: memory address must be 0-15 (got ${value}).` };
  }
  return { operand: { mode: 'address', value } };
}

function assemble(sourceText) {
  const rawLines = sourceText.split('\n');
  const instructions = new Map();
  const lineOrder = [];
  const errors = [];
  const pendingJumps = [];

  rawLines.forEach((raw, idx) => {
    const lineNumber = idx + 1;
    const withoutComment = raw.split(';')[0].trim();
    if (!withoutComment) return;

    const parts = withoutComment.split(/\s+/);
    const op = parts[0].toUpperCase();
    const operandRaw = parts.slice(1).join(' ');

    if (!ALL_OPS.has(op)) {
      errors.push({ line: lineNumber, message: `Unknown instruction "${parts[0]}".` });
      return;
    }

    if (OPS_NO_OPERAND.has(op)) {
      if (operandRaw) {
        errors.push({ line: lineNumber, message: `${op} doesn't take an operand.` });
        return;
      }
      instructions.set(lineNumber, { op, operand: null, raw });
      lineOrder.push(lineNumber);
      return;
    }

    if (!operandRaw) {
      errors.push({ line: lineNumber, message: `${op} needs an operand.` });
      return;
    }

    let mode = 'addr';
    if (OPS_ADDR_OR_IMMEDIATE.has(op)) mode = 'addr-or-imm';
    else if (OPS_LINE.has(op)) mode = 'line';

    const result = parseOperand(operandRaw, lineNumber, mode);
    if (result.error) {
      errors.push({ line: lineNumber, message: result.error });
      return;
    }

    instructions.set(lineNumber, { op, operand: result.operand, raw });
    lineOrder.push(lineNumber);
    if (mode === 'line') pendingJumps.push({ line: lineNumber, target: result.operand.value });
  });

  for (const { line, target } of pendingJumps) {
    if (!instructions.has(target)) {
      errors.push({ line, message: `Line ${line}: jump target (line ${target}) isn't an instruction.` });
    }
  }

  if (errors.length) {
    errors.sort((a, b) => a.line - b.line);
    return { ok: false, errors };
  }
  if (!lineOrder.length) {
    return { ok: false, errors: [{ line: 1, message: 'Write at least one instruction.' }] };
  }

  return { ok: true, program: { instructions, lineOrder }, sourceLines: rawLines };
}
