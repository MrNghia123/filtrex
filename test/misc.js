const { compileExpression } = require("../dist/cjs/filtrex");

const { describe, it } = require("mocha");

const chai = require("chai");
const assertArrays = require('chai-arrays');

chai.use(assertArrays);
const { expect } = chai;


const eval = (str, obj) => compileExpression(str)(obj);




describe('Various other things', () => {

    it('in / not in', () => {
        // value in array
        expect( eval('5 in (1, 2, 3, 4)') ).equals(false);
        expect( eval('3 in (1, 2, 3, 4)') ).equals(true);
        expect( eval('5 not in (1, 2, 3, 4)') ).equals(true);
        expect( eval('3 not in (1, 2, 3, 4)') ).equals(false);

        // array in array
        expect( eval('(1, 2) in (1, 2, 3)') ).equals(true);
        expect( eval('(1, 2) in (2, 3, 1)') ).equals(true);
        expect( eval('(3, 4) in (1, 2, 3)') ).equals(false);
        expect( eval('(1, 2) not in (1, 2, 3)') ).equals(false);
        expect( eval('(1, 2) not in (2, 3, 1)') ).equals(false);
        expect( eval('(3, 4) not in (1, 2, 3)') ).equals(true);

        // other edge cases
        expect( eval('(1, 2) in 1'    ) ).equals(false);
        expect( eval('1 in 1'         ) ).equals(true);
        expect( eval('(1, 2) not in 1') ).equals(true);
        expect( eval('1 not in 1'     ) ).equals(false);
    });

    it('string support', () => {
        expect( eval('foo == "hello"', {foo:'hello'}) ).equals(true);
        expect( eval('foo == "hello"', {foo:'bye'  }) ).equals(false);
        expect( eval('foo != "hello"', {foo:'hello'}) ).equals(false);
        expect( eval('foo != "hello"', {foo:'bye'  }) ).equals(true);
        expect( eval('foo in ("aa", "bb")', {foo:'aa'}) ).equals(true);
        expect( eval('foo in ("aa", "bb")', {foo:'cc'}) ).equals(false);
        expect( eval('foo not in ("aa", "bb")', {foo:'aa'}) ).equals(false);
        expect( eval('foo not in ("aa", "bb")', {foo:'cc'}) ).equals(true);

        expect( eval(`"\n"`) ).equals("\n");
        expect( eval(`"\u0000"`) ).equals("\u0000");
        expect( eval(`"\uD800"`) ).equals("\uD800");
    });

    it('regexp support', () => {
        expect( eval('foo ~= "^[hH]ello"', {foo:'hello'}) ).equals(true);
        expect( eval('foo ~= "^[hH]ello"', {foo:'bye'  }) ).equals(false);
    });

    it('array support', () => {
        const arr = eval('(42, "fifty", pi)', {pi: Math.PI});

        expect(arr).is.array();
        expect(arr).to.be.equalTo([42, "fifty", Math.PI]);
    });

    it('ternary operator', () => {
        expect( eval('if 1 > 2 then 3 else 4') ).equals(4);
        expect( eval('if 1 < 2 then 3 else 4') ).equals(3);
    });

    it('kitchensink', () => {
        var kitchenSink = compileExpression('if 4 > lowNumber * 2 and (max(a, b) < 20 or foo) then 1.1 else 9.4');
        expect( kitchenSink({lowNumber: 1.5, a: 10, b: 12, foo: false}) ).equals(1.1);
        expect( kitchenSink({lowNumber: 3.5, a: 10, b: 12, foo: false}) ).equals(9.4);
    });

    it('custom functions', () => {
        let triple = x => x * 3;
        let options = { extraFunctions: {triple} };
        expect( compileExpression('triple(v)', options)({v:7}) ).equals(21);
    });

    it('custom property function basics', () => {
        expect(
            compileExpression('a', { customProp: name => name === 'a' })()
        ).equals(true);

        expect(
            compileExpression('a + bb + ccc', { customProp: name => name.length })()
        ).equals(6);

        expect(
            compileExpression('a + b * c', { customProp: (name, get) => get(name) })
            ({ a:1, b:2, c:3 })
        ).equals(7);

        expect(
            compileExpression('a', { customProp: (name, get) => get(name) })({ a: true })
        ).equals(true);

        let object = {a: 2};
        expect(
            compileExpression('a', { customProp: (_,__,obj) => obj === object })(object)
        ).equals(true);
    });

    it('custom property function text search', () => {
        let textToSearch = "able was i ere I saw elba\nthe Rain in spain falls MAINLY on the plain";
        let doesTextMatch = name =>  textToSearch.indexOf(name) !== -1;
        let evalProp = exp => compileExpression(exp, { customProp: doesTextMatch })();


        expect( evalProp('able and was and i') ).equals(true);
        expect( evalProp('able and was and dog') ).equals(false);
        expect( evalProp('able or dog') ).equals(true);
        expect( evalProp('able') ).equals(true);
        expect( evalProp('Rain and (missing or MAINLY)') ).equals(true);
        expect( evalProp('NotThere or missing or falls and plain') ).equals(true);
    });

    it('custom property function proxy', () => {
        let prefixedName = (str, sub) => str.substr(0, sub.length) === sub && str.substr(sub.length);
        let tripleName = str => prefixedName(str, 'triple_');

        let proxy = (name, get) => tripleName(name) ? 3 * get(tripleName(name)) : get(name);
        let evalProp = exp => compileExpression(exp, {customProp: proxy})({ a:1, b:2, c:3 });

        expect( evalProp('a') ).equals(1);
        expect( evalProp('triple_a') ).equals(3);
        expect( evalProp('a + triple_b * c') ).equals(19);
    });

    it('throws when using old API', () => {
        let extraFunctions = { myCustomFunc: n => n*n };
        let customProp = () => 'foo';

        expect( () => compileExpression('', extraFunctions) ).throws();
        expect( () => compileExpression('', {}, customProp) ).throws();
        expect( () => compileExpression('', extraFunctions, customProp) ).throws();
    });

    it('doesn\'t recognise non-callable values as extra functions', () => {
        let options = { extraFunctions: { sqrt: undefined, a: 42, b: {} } };
        let eval = str => compileExpression(str, options)();

        expect(eval('a()')).is.instanceOf(ReferenceError);
        expect(eval('b()')).is.instanceOf(ReferenceError);

        let err = eval('sqrt(4)');
        expect(err).is.instanceOf(ReferenceError);
        expect(err.message).equals("Unknown function: sqrt()");
    });

    it('gives the correct precedence to "in" and "not in"', () => {
        expect( eval('4 + 3 in (7, 8)') ).equals(true);
        expect( eval('4 + 3 in (6, 8)') ).equals(false);
        expect( eval('4 + 3 not in (7, 8)') ).equals(false);
        expect( eval('4 + 3 not in (6, 8)') ).equals(true);
    })

});
