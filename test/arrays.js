const { compileExpression } = require("../lib/cjs/filtrex");

const { describe, it } = require("mocha");

const chai = require("chai");
const assertArrays = require('chai-arrays');

chai.use(assertArrays);
const { expect } = chai;


const eval = (str, obj) => compileExpression(str)(obj);




describe('One-element arrays', () => {
    it('multi-element array', () => {
        const arr = eval('[42, "fifty", pi]', {pi: Math.PI});

        expect(arr).is.array();
        expect(arr).to.be.equalTo([42, "fifty", Math.PI]);
    });

    it('single-element array', () => {
        const arr = eval('[42]');

        expect(arr).is.array();
        expect(arr).to.be.equalTo([42]);
    });
})