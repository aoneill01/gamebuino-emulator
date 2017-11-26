import { Atsamd21 } from './atsamd21';

var flash = new Uint8Array(10016);

var oReq = new XMLHttpRequest();
var atsamd21 = new Atsamd21();

oReq.onload = function(e) {
    atsamd21.loadFlash(new Uint8Array(oReq.response), 0x2000);
    atsamd21.portA.addOutListener((mask: number, value: number) => {
        console.log(`mask: ${mask.toString(2)}; value: ${value.toString(2)}`);

        var mask = 1;
        for (var i = 0; i < 32; i++) {
            var id = `pa${i < 10 ? '0' + i : i}`;
            document.getElementById(id).className = (mask & value) ? 'led on' : 'led';
            mask = mask << 1;
        }
    });

    run();
}
oReq.open("GET", "Blink.ino.arduino_zero.bin");
oReq.responseType = "arraybuffer";
oReq.send();

var total:number = 0;

function run() {
    const loopCount = 480000;
    var count = loopCount;
    for (var i = 0; i < count; i++) {
        atsamd21.step();
    }
    total += loopCount;

    setTimeout(run, 0);
}

setInterval(function() {
    document.getElementById('rate').innerHTML = Math.round((total / 1000000)) + " MHz";
    total = 0;
}, 1000);
