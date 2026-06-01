# Circom Tester — Example Project

A minimal working example showing how to use [`circom_tester`](https://github.com/iden3/circom_tester) to test your Circom circuits in a JavaScript project.

This repo is intended as a **learning reference** for developers who want to add tests to their own Circom circuits.

---

## What Is This?

This project tests a simple multiplication circuit (`Multiplier2.circom`) that proves knowledge of two numbers `a` and `b` such that `c = a × b`, without revealing `a` or `b`.

It demonstrates how to:
- Compile a `.circom` circuit inside a test
- Generate a witness from inputs
- Check that constraints are satisfied
- Read output signal values and assert them
- Run the circuit using both the **WASM** and **C++** backends

---

## Project Structure

```
.
├── Multiplier2.circom   # The circuit being tested
├── multiplier2.js       # Test file (Mocha + circom_tester)
├── package.json         # Project dependencies
└── .gitignore
```

---

## The Circuit

```circom
pragma circom 2.0.0;

template Multiplier2() {
    signal input a;
    signal input b;
    signal output c;
    c <== a * b;
}

component main = Multiplier2();
```

- `signal input` — private inputs to the circuit
- `signal output` — public output
- `<==` — assigns a value **and** creates a constraint (proves the relationship holds)

---

## Prerequisites

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Install Circom

Follow the official guide: https://docs.circom.io/getting-started/installation/

```bash
# Quick install via cargo (Rust)
cargo install circom
```

### 3. Install C++ build dependencies

These are only needed for the C++ backend tests. Skip if you only care about WASM tests.

```bash
sudo apt-get install -y nlohmann-json3-dev libgmp-dev nasm
```

| Package | Purpose |
|---|---|
| `nlohmann-json3-dev` | JSON parsing in the C++ witness calculator |
| `libgmp-dev` | GNU Multiple Precision arithmetic (field operations) |
| `nasm` | Assembler for optimized field arithmetic |

---

## Running the Tests

```bash
npx mocha -p 'multiplier2.js'
```

To run a single test by name:

```bash
npx mocha -p 'multiplier2.js' --grep "generating wasm"
```

Expected output:

```
Multiplier2
  ✔ Checking the compilation of a simple circuit generating wasm (100ms)
  ✔ Checking the compilation of a simple circuit generating wasm in a given folder (70ms)
  ✔ Checking the compilation of a simple circuit generating wasm in a given folder without recompiling (46ms)
  ✔ Checking the compilation of a simple circuit generating C (5544ms)
  ✔ Checking the compilation of a simple circuit generating C in a given folder (5347ms)
  ✔ Checking the compilation of a simple circuit generating C in a given folder without recompiling (43ms)

6 passing (11s)
```

> **Note:** If you see linker warnings about `fr_asm.o: missing .note.GNU-stack section`, these are harmless and come from circom-generated assembly.

---

## How the Tests Work

### 1. Compile the circuit

`circom_tester` handles compilation for you inside the test. No need to run `circom` manually.

```js
const { wasm: wasm_tester, c: c_tester } = require("circom_tester");

const circuit = await wasm_tester("path/to/MyCircuit.circom");
```

### 2. Generate a witness

A **witness** is the full assignment of all signals (inputs, intermediate values, outputs) that satisfies the circuit constraints.

```js
const witness = await circuit.calculateWitness({ a: 3, b: 11 });
```

### 3. Check constraints

Verify that the witness satisfies all R1CS constraints defined in the circuit:

```js
await circuit.checkConstraints(witness);
```

### 4. Read output signals

```js
const outputs = await circuit.getOutput(witness, { c: 1 });
console.log(outputs.c); // "33"
```

### 5. Assert values

```js
const assert = require("chai").assert;
assert.equal(outputs.c, "33");
```

---

## WASM vs C++ Backend

| | WASM (`wasm_tester`) | C++ (`c_tester`) |
|---|---|---|
| **Speed** | Fast to compile | Faster witness generation |
| **Dependencies** | None beyond Node.js | `libgmp`, `nlohmann-json`, `nasm` |
| **Best for** | Development & CI | Large circuits with many constraints |

---

## Useful Options

```js
const circuit = await wasm_tester("MyCircuit.circom", {
    // Save compiled artifacts to a specific folder instead of a temp dir
    output: path.join(__dirname, "tmp"),

    // Reuse existing artifacts without recompiling (speeds up repeated runs)
    recompile: false,
});
```

---

## Field Arithmetic

All signal values in Circom are elements of the **BN128 scalar field**. Numbers wrap around at:

```
p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
```

Use `ffjavascript` for field-level computations in your tests:

```js
const { F1Field, Scalar } = require("ffjavascript");
const p = Scalar.fromString("21888242871839275...");
const Fr = new F1Field(p);
```

---

## Adapting This to Your Own Circuit

1. Replace `Multiplier2.circom` with your own `.circom` file
2. Update the `calculateWitness({...})` call with your circuit's input signals
3. Update `getOutput(witness, {...})` with your output signals
4. Add `assert.equal(...)` checks for the expected output values

---

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [circom_tester on GitHub](https://github.com/iden3/circom_tester)
- [SnarkJS](https://github.com/iden3/snarkjs) — for proof generation & verification
- [ffjavascript](https://github.com/iden3/ffjavascript) — finite field arithmetic in JS
