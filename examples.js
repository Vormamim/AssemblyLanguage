// examples.js — the click-to-load example programs, roughly ordered from
// simplest to most advanced. `memory` gives the starting values for specific
// addresses (the "Input" stage); every other address defaults to 0.

const EXAMPLES = {
  hello: {
    label: 'Hello Text',
    memory: {},
    code:
`; Print a short greeting, one character at a time.
; No loop needed here — this is Output on its own.
LOAD #'H'
OUTC
LOAD #'i'
OUTC
LOAD #'!'
OUTC
HALT
`
  },

  copyNumber: {
    label: 'Copy a Number',
    memory: { 0: 7 },
    code:
`; The simplest program that actually does something:
; copy memory 0 into memory 1, then print it.
LOAD 0
STORE 1
OUT
HALT
`
  },

  addTwo: {
    label: 'Add Two Numbers',
    memory: { 0: 12, 1: 9 },
    code:
`; Add the two input values in memory 0 and 1,
; store the result, then print it.
LOAD 0
ADD 1
STORE 2
OUT
HALT
`
  },

  subtractTwo: {
    label: 'Subtract Two Numbers',
    memory: { 0: 5, 1: 9 },
    code:
`; Subtract memory 1 from memory 0, store and print the result.
; Try values where the answer is negative — watch the binary flip.
LOAD 0
SUB 1
STORE 2
OUT
HALT
`
  },

  areEqual: {
    label: 'Are They Equal?',
    memory: { 0: 5, 1: 5 },
    code:
`; Compare memory 0 and memory 1. Prints YES if equal, NO if not.
LOAD 0
SUB 1
JZ 10
LOAD #'N'
OUTC
LOAD #'O'
OUTC
JMP 16
LOAD #'Y'
OUTC
LOAD #'E'
OUTC
LOAD #'S'
OUTC
HALT
`
  },

  countdown: {
    label: 'Countdown Loop',
    memory: { 0: 3 },
    code:
`; Countdown loop — counts memory[0] down to 0.
; Try editing memory cell 0 before you run.
LOAD 0
JZ 10
OUT
SUB #1
STORE 0
JMP 3

HALT
`
  },

  skipCounting: {
    label: 'Skip Counting by Twos',
    memory: { 0: 0, 1: 6 },
    code:
`; Skip counts by twos from memory 0 up to memory 1 (inclusive).
LOAD 0
OUT
SUB 1
JZ 11
LOAD 0
ADD #2
STORE 0
JMP 2

HALT
`
  },

  multiply: {
    label: 'Multiply by Repeated Addition',
    memory: { 0: 4, 1: 3 },
    code:
`; There's no MULTIPLY instruction — so this multiplies memory 0 by
; memory 1 the old-fashioned way: adding memory 0 to itself, memory 1 times.
LOAD 1
JZ 12
LOAD 2
ADD 0
STORE 2
LOAD 1
SUB #1
STORE 1
JMP 3
LOAD 2
OUT
HALT
`
  },

  powersOfTwo: {
    label: 'Powers of Two',
    memory: { 0: 6, 1: 1 },
    code:
`; Doubling! memory 1 starts at 1 and doubles every pass, memory 0 counts
; how many times to print it. Watch ACC's single lit bit march left.
LOAD 0
JZ 14
LOAD 1
OUT
ADD 1
STORE 1
LOAD 0
SUB #1
STORE 0
JMP 3

HALT
`
  },

  overflow: {
    label: 'Overflow!',
    memory: { 0: 125 },
    code:
`; EduCPU-8 is a genuine 8-bit chip — ACC can only hold -128 to 127.
; Watch what happens when adding 1 pushes it past the top.
LOAD 0
OUT
ADD #1
OUT
ADD #1
OUT
ADD #1
OUT
ADD #1
OUT
HALT
`
  }
};
