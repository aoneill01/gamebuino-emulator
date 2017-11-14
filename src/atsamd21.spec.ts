import { Atsamd21 } from './atsamd21';
import { expect } from 'chai';
import 'mocha';
import * as fs from 'fs';

fs.readFile('./Blink.ino.arduino_zero.bin', function(err, data) {  
    if (err) throw err;
    var memory = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) memory[i] = data[i];

    var micro = new Atsamd21();
    micro.loadFlash(memory, 0x2000);
    var count = 14;
    for (var i = 0; i < count; i++) {
        micro.step();
    }
});

/*
fs.readFile('./blinker01.gcc.thumb.flash.bin', function(err, data) {  
    if (err) throw err;
    var memory = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) memory[0x0000 + i] = data[i];

    var micro = new Atsamd21();
    micro.loadFlash(memory);
        var count = 48000000;
        for (var i = 0; i < count; i++) {
            micro.step();
        }
});

describe('blinker01.gcc.thumb.flash.bin program', () => {
    var micro: Atsamd21;
    var flash: Uint8Array;

    before((done) => {
        fs.readFile('./blinker01.gcc.thumb.flash.bin', function(err, data) { 
            if (err) throw err;
            flash = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) flash[i] = data[i];
            
            done();
        });
    })

    beforeEach(() => {
        micro = new Atsamd21();
        micro.loadFlash(flash);
    });

    it('loads correct initial state', () => {
        expect(micro.readRegister(micro.pcIndex)).to.equal(0x40 + 2);
        expect(micro.readRegister(micro.spIndex)).to.equal(0x20001000);
        expect(micro.readRegister(micro.lrIndex)).to.equal(0xffffffff);
    })

    it('executes first instruction', () => {
        // bl 64
        micro.step();
        micro.step();

        expect(micro.readRegister(micro.pcIndex)).to.equal(0x64 + 2);
    });

    it('executes first instruction of notmain', () => {
        var accessedPeripheral: boolean = false;
        micro.portA.addOutListener((mask: number, value: number) => {
            accessedPeripheral = true;
        });
        //micro.peripheralCallback = (addr: number, value: number) => { accessedPeripheral = true; }
        // bl 64
        micro.step();
        micro.step();
        // movs	r1, #128
        micro.step();

        expect(micro.readRegister(1)).to.equal(128);
        expect(accessedPeripheral).to.be.false;
    });

    
    it('turns on light', () => {
        var lightOn: boolean = false;
        micro.portA.addOutListener((mask: number, value: number) => {
            if (((1<<17) & mask) && ((1<<17) & value)) lightOn = true;
        });

        for (let i = 0; i < 50000; i++) micro.step();

        expect(lightOn).to.be.true;
    });
})
*/