const chai = require("chai");
const path = require("path");

// circom_tester compiles .circom files and lets you run them in tests.
// wasm_tester: compiles to WebAssembly (fast, portable)
// c_tester:    compiles to native C++ binary (faster witness generation, requires build tools)
const wasm_tester = require("circom_tester").wasm;
const c_tester = require("circom_tester").c;

// ffjavascript provides finite field arithmetic for the BN128 elliptic curve used by Groth16.
// All signal values in circom live in this field (numbers wrap around at p).
const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;

// p is the BN128 scalar field prime. Any arithmetic in the circuit is done modulo p.
exports.p = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const Fr = new F1Field(exports.p);

const assert = chai.assert;

describe("Multiplier2", function () {
    // Circuit compilation + witness generation can take several seconds, so we raise the timeout.
    this.timeout(100000);

    // --- WASM backend tests ---

    it("Checking the compilation of a simple circuit generating wasm", async function () {
        // Compile Multiplier2.circom to WASM. Artifacts are placed in a temp folder automatically.
        const circuit = await wasm_tester(
            path.join(__dirname, "Multiplier2.circom")
        );

        // calculateWitness runs the circuit with the given inputs and returns the witness —
        // the full assignment of all signals (inputs, intermediate, outputs) that satisfies the constraints.
        // These large numbers are valid BN128 field elements (less than p).
        const w = await circuit.calculateWitness({
            a: "18557398763080563439574185585645102004924653463016315326623530540120602021652",
            b: "6905411550336032894518809912132382781376814349417260111983470984156998288047"
        });

        // Verify that the witness satisfies all the R1CS constraints defined in the circuit.
        // For Multiplier2, this checks that c === a * b (mod p).
        await circuit.checkConstraints(w);

        // Extract named signal values from the witness.
        // The second argument maps signal names to their indices in the witness array.
        const outputs = await circuit.getOutput(w, {"a": 1, "b": 1, "c": 1});
        console.log(outputs);

        // Assert the output c equals the expected product of a * b (mod p).
        assert.equal(outputs.c, "17557711783593955402415343928078493368246126305786338715665102716827650933")
    });

    it("Checking the compilation of a simple circuit generating wasm in a given folder", async function () {
        // Same as above but artifacts are saved to a specific folder (./tmp) instead of a temp dir.
        // Useful when you want to inspect the generated .wasm, .sym, .r1cs files.
        const circuit = await wasm_tester(
            path.join(__dirname, "Multiplier2.circom"),
            {
                output: path.join(__dirname, "tmp"),
            }
        );
        const w = await circuit.calculateWitness({a: 2, b: 4});
        await circuit.checkConstraints(w);
    });

    it("Checking the compilation of a simple circuit generating wasm in a given folder without recompiling", async function () {
        // recompile: false tells circom_tester to reuse existing artifacts in ./tmp
        // instead of recompiling the circuit. This speeds up repeated test runs.
        // Requires the previous test (which compiled to ./tmp) to have run first.
        const circuit = await wasm_tester(
            path.join(__dirname, "Multiplier2.circom"),
            {
                output: path.join(__dirname, "tmp"),
                recompile: false,
            }
        );
        const w = await circuit.calculateWitness({a: 6, b: 3});
        await circuit.checkConstraints(w);
    });

    // --- C++ backend tests ---
    // c_tester compiles the circuit to a native binary using g++ and nasm.
    // The witness calculation is faster but requires libgmp, nlohmann-json, and nasm to be installed.

    it("Checking the compilation of a simple circuit generating C", async function () {
        const circuit = await c_tester(
            path.join(__dirname, "Multiplier2.circom")
        );
        try {
            const w = await circuit.calculateWitness({a: 2, b: 4});
            await circuit.checkConstraints(w);
        } catch (e) {
            if (e.message.includes("Illegal instruction")) {
                // Some CI runners (e.g. older GitHub Actions hardware) don't support the
                // ADX instruction set used by the C++ witness calculator. Skip gracefully.
                this.skip();
            } else {
                throw e;
            }
        }
    });

    it("Checking the compilation of a simple circuit generating C in a given folder", async function () {
        // Same as above but saves C++ artifacts to ./tmp for inspection.
        const circuit = await c_tester(
            path.join(__dirname, "Multiplier2.circom"),
            {
                output: path.join(__dirname, "tmp"),
            }
        );
        try {
            const w = await circuit.calculateWitness({a: 2, b: 4});
            await circuit.checkConstraints(w);
        } catch (e) {
            if (e.message.includes("Illegal instruction")) {
                this.skip();
            } else {
                throw e;
            }
        }
    });

    it("Checking the compilation of a simple circuit generating C in a given folder without recompiling", async function () {
        // Reuses the compiled C++ binary from ./tmp built by the previous test.
        const circuit = await c_tester(
            path.join(__dirname, "Multiplier2.circom"),
            {
                output: path.join(__dirname, "tmp"),
                recompile: false,
            }
        );
        try {
            const w = await circuit.calculateWitness({a: 6, b: 3});
            await circuit.checkConstraints(w);
        } catch (e) {
            if (e.message.includes("Illegal instruction")) {
                this.skip();
            } else {
                throw e;
            }
        }
    });

});