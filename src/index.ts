import { Atsamd21 } from './atsamd21';
import { St7735 } from './st7735';
import { Buttons } from './buttons';

var oReq = new XMLHttpRequest();
window["atsamd21"] = new Atsamd21();
var screen;
var atsamd21 = window["atsamd21"];
var running = false;

var exampleGames = [
    /*
    {
        name: "Defend Pluto",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/DefendPluto/DefendPluto.bin"
    },
    {
        name: "META Hexagon",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/MetaHexagon/MetaHexagon.bin"
    },
    {
        name: "Omega Horizon",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/OMEGA_HORIZON/OMEGA_HORIZON.bin"
    },
    {
        name: "Picomon",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/picomon/picomon.bin"
    },
    {
        name: "Reuben",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/reuben3/reuben3.bin"
    },*/
    {
        name: "Solitaire",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/Solitaire/Solitaire.bin"
    }/*,
    {
        name: "Super Crate META",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/SuperCrateMETA/SuperCrateMETA.bin"
    },
    {
        name: "Yatzy",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/YATZY/YATZY.bin"
    }*/
];

listGames();
resetButton();
listenToFileUpload();

function loadGame(url:string): void {
    oReq.open("GET", url);
    oReq.responseType = "arraybuffer";
    oReq.send();
}

oReq.onload = function(e) {
    load(oReq.response);
}

var total:number = 0;

function run() {
    try {
        const loopCount = 480000;
        var priorTick = atsamd21.tickCount;
        var count = loopCount;
        for (var i = 0; i < count; i++) {
            atsamd21.step();
        }
        total += atsamd21.tickCount - priorTick;

        screen.updateCanvas();

        setTimeout(run, 0);
    }
    catch (error) {
        running = false;
        document.getElementById("error").innerHTML = "ERROR. See console for details."
        throw error;
    }

}

setInterval(function() {
    document.getElementById('rate').innerHTML = Math.round((total / 1000000)) + " MHz";
    total = 0;
    // console.log((atsamd21.readRegister(atsamd21.pcIndex)-2).toString(16));
}, 1000);

function listGames() {
    var example = document.getElementById('example');
    example.setAttribute("class", "game-link");
    example.onclick = function() { loadGame (exampleGames[0].url); return false; };
    example.appendChild(document.createTextNode('Try an example game!'));
}

function resetButton() {
    var elem = document.getElementById('reset-container');
    var btn = document.createElement("button");
    btn.onclick = function() { atsamd21.reset(0x4000); };
    btn.innerHTML = 'Reset';
    elem.appendChild(btn);
}

function listenToFileUpload() {
    var fileUpload = <HTMLInputElement>document.getElementById('file-upload');
    fileUpload.onchange = function() {
        if (fileUpload.files.length == 1) {
            var f = fileUpload.files[0];
            var reader = new FileReader();
            reader.onload = function (e) {
                var target: any = e.target;
                load(target.result);
            };
            reader.readAsArrayBuffer(f);
        }
    }
}

function load(buffer: ArrayBuffer) {
    document.getElementById("error").innerHTML = "";
    
    window["atsamd21"] = new Atsamd21();
    atsamd21 = window["atsamd21"];
    atsamd21.loadFlash(new Uint8Array(buffer), 0x4000);

    var canvas = <HTMLCanvasElement>document.getElementById('screen');
    var ctx = canvas.getContext("2d");
    screen = new St7735(atsamd21.sercom4, atsamd21.portA, atsamd21.portB, ctx);
    var buttons = new Buttons(atsamd21.sercom4, atsamd21.portA, atsamd21.portB);

    if (!running) {
        running = true;
        run();
    }
}