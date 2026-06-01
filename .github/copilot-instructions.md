# Copilot Instructions

## Project Overview

This is a zk-SNARK learning repository using **Circom** (circuit language) and **SnarkJS** (JavaScript proving/verification toolkit). The `multiplier2_test` directory tests Circom circuit compilation and witness generation via `circom_tester`.

The broader repo (`/zk/circom/`) covers the full Groth16 workflow:
- Circuit authoring (`.circom` files)
- Witness generation
- Trusted setup (Powers of Tau → `.ptau` → `.zkey`)
- Proof generation and verification
- Solidity verifier export for on-chain verification

## Running Tests

Tests use **Mocha** + **Chai** via `circom_tester`:

```bash
# Run all tests
npx mocha multiplier2.js

# Run a single test by name
npx mocha multiplier2.js --grep "generating wasm"
```

> The `package.json` test script is a placeholder (`exit 1`). Use `npx mocha` directly.

## Key Conventions

### Circuit Files (`.circom`)
- Use `pragma circom 2.0.0;` (or `2.1.x`) at the top
- Define logic in `template` blocks; instantiate with `component main = TemplateName();`
- Use `<==` for assignment + constraint; use `===` for constraint-only
- Signal arrays: `signal input in[2];`
- Compiled artifacts land in `<name>_js/` (WASM) and `<name>_cpp/` (C++) directories

### Compiling a circuit
```bash
circom MyCircuit.circom --r1cs --wasm --sym --c
```

### Test Structure (`circom_tester`)
```js
const { wasm: wasm_tester, c: c_tester } = require("circom_tester");

const circuit = await wasm_tester("path/to/Circuit.circom", {
    output: "path/to/tmp",   // optional: artifact output dir
    recompile: false,        // optional: skip recompilation
});
const witness = await circuit.calculateWitness({ a: 3, b: 11 });
await circuit.checkConstraints(witness);
const outputs = await circuit.getOutput(witness, { c: 1 });
```
- `c_tester` works the same way but compiles to C++ — wrap `calculateWitness` in try/catch and `this.skip()` on `"Illegal instruction"` errors (older CPUs don't support ADX instructions used by the C++ witness calculator).

### Field Arithmetic
All values are elements of the BN128 scalar field:
```
p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
```
Use `ffjavascript`'s `F1Field` and `Scalar` for field-level computations in tests.

## Full Groth16 Workflow (reference)

```bash
# 1. Compile
circom multiplier2.circom --r1cs --wasm --sym --c

# 2. Generate witness
cd multiplier2_js
node generate_witness.js multiplier2.wasm input.json witness.wtns

# 3. Trusted setup — Phase 1
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# 4. Trusted setup — Phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup multiplier2.r1cs pot12_final.ptau multiplier2_0000.zkey
snarkjs zkey contribute multiplier2_0000.zkey multiplier2_0001.zkey --name="1st Contributor" -v
snarkjs zkey export verificationkey multiplier2_0001.zkey verification_key.json

# 5. Prove & verify
snarkjs groth16 prove multiplier2_0001.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json

# 6. Export Solidity verifier
snarkjs zkey export solidityverifier multiplier2_0001.zkey verifier.sol
```
