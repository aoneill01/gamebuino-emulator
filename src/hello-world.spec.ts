import { HelloWorld } from './hello-world';
import { expect } from 'chai';
import 'mocha';

describe('sayHello function', () => {

    it('should return hi', () => {
        expect(HelloWorld.sayHello()).to.equal('hi');
    });

});

describe('sayGoodbye function', () => {
    
    it('should return goodbye', () => {
        expect(HelloWorld.sayGoodbye()).to.equal('goodbye');
    });

});