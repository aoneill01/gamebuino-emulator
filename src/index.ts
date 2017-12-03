import { Atsamd21 } from './atsamd21';

var flash = new Uint8Array(10016);

var oReq = new XMLHttpRequest();
var atsamd21 = new Atsamd21();
import { St7735 } from './st7735';

oReq.onload = function(e) {
    atsamd21.loadFlash(new Uint8Array(oReq.response), 0x2000);

    var canvas = <HTMLCanvasElement>document.getElementById('screen');
    var ctx = canvas.getContext("2d");
    var screen = new St7735(atsamd21.sercom4, atsamd21.portA, ctx);

    run();
}
oReq.open("GET", "graphicstest.ino.bin");
oReq.responseType = "arraybuffer";
oReq.send();

var total:number = 0;

function run() {
    const loopCount = 480000;
    var priorTick = atsamd21.tickCount;
    var count = loopCount;
    for (var i = 0; i < count; i++) {
        atsamd21.step();
    }
    total += atsamd21.tickCount - priorTick;

    setTimeout(run, 0);
}

setInterval(function() {
    document.getElementById('rate').innerHTML = Math.round((total / 1000000)) + " MHz";
    total = 0;
}, 1000);
