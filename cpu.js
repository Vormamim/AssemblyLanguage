// cpu.js — EduCPU-8 simulator core. No DOM access; pure state machine so it
// can be driven by ui.js (or tested headlessly).

const MEMORY_SIZE = 16;

// EduCPU-8 is a genuine 8-bit chip: ACC and every memory cell hold a signed
// byte (-128..127), not an unlimited-precision number that merely *looks*
// 8-bit in the binary display. Wrapping here (not just cosmetically at
// render time) is what makes the Overflow! example real: 127 + 1 truly
// becomes -128, matching the two's-complement bit pattern shown on screen.
function wrapByte(value) {
  const unsigned = ((value % 256) + 256) % 256;
  return unsigned > 127 ? unsigned - 256 : unsigned;
}

class CPU {
  constructor(memorySize) {
    this.memorySize = memorySize;
    this.instructions = new Map();
    this.lineOrder = [];
    this.memory = new Array(this.memorySize).fill(0);
    this.acc = 0;
    this.pc = null;
    this.zeroFlag = false;
    this.halted = true;
    this.output = [];
  }

  // program: { instructions: Map<line, {op, operand}>, lineOrder: number[] }
  // initialMemory: full-length array of starting memory values
  load(program, initialMemory) {
    this.instructions = program.instructions;
    this.lineOrder = program.lineOrder;
    this.memory = initialMemory ? initialMemory.map(wrapByte) : new Array(this.memorySize).fill(0);
    this.acc = 0;
    this.zeroFlag = false;
    this.output = [];
    this.pc = this.lineOrder.length ? this.lineOrder[0] : null;
    this.halted = this.pc === null;
  }

  nextLine(afterLine) {
    for (const line of this.lineOrder) {
      if (line > afterLine) return line;
    }
    return null;
  }

  resolveOperandValue(operand) {
    return operand.mode === 'immediate' ? operand.value : this.memory[operand.value];
  }

  step() {
    if (this.halted || this.pc === null) return { halted: true, effects: [] };

    const line = this.pc;
    const instr = this.instructions.get(line);
    const effects = [{ kind: 'exec-line', line }];
    let nextPc = this.nextLine(line);

    switch (instr.op) {
      case 'LOAD': {
        if (instr.operand.mode === 'address') effects.push({ kind: 'read-mem', addr: instr.operand.value });
        this.acc = wrapByte(this.resolveOperandValue(instr.operand));
        effects.push({ kind: 'reg-acc', value: this.acc });
        break;
      }
      case 'ADD': {
        if (instr.operand.mode === 'address') effects.push({ kind: 'read-mem', addr: instr.operand.value });
        this.acc = wrapByte(this.acc + this.resolveOperandValue(instr.operand));
        effects.push({ kind: 'reg-acc', value: this.acc });
        break;
      }
      case 'SUB': {
        if (instr.operand.mode === 'address') effects.push({ kind: 'read-mem', addr: instr.operand.value });
        this.acc = wrapByte(this.acc - this.resolveOperandValue(instr.operand));
        effects.push({ kind: 'reg-acc', value: this.acc });
        break;
      }
      case 'STORE': {
        this.memory[instr.operand.value] = this.acc;
        effects.push({ kind: 'write-mem', addr: instr.operand.value, value: this.acc });
        break;
      }
      case 'JMP': {
        nextPc = instr.operand.value;
        break;
      }
      case 'JZ': {
        if (this.zeroFlag) nextPc = instr.operand.value;
        break;
      }
      case 'OUT': {
        const text = String(this.acc) + ' ';
        this.output.push(text);
        effects.push({ kind: 'output', text });
        break;
      }
      case 'OUTC': {
        const code = ((this.acc % 256) + 256) % 256;
        const ch = String.fromCharCode(code);
        this.output.push(ch);
        effects.push({ kind: 'output', text: ch });
        break;
      }
      case 'HALT': {
        nextPc = null;
        break;
      }
      default:
        break;
    }

    if (instr.op === 'LOAD' || instr.op === 'ADD' || instr.op === 'SUB') {
      this.zeroFlag = this.acc === 0;
      effects.push({ kind: 'reg-z', value: this.zeroFlag });
    }

    this.pc = nextPc;
    this.halted = nextPc === null;
    effects.push({ kind: 'reg-pc', value: this.pc, halted: this.halted });
    if (this.halted) effects.push({ kind: 'halt' });

    return { halted: this.halted, effects, line };
  }
}
