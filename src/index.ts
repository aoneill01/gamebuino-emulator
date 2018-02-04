import { Atsamd21 } from './atsamd21';
import { St7735 } from './st7735';
import { Buttons } from './buttons';

var oReq = new XMLHttpRequest();
window["atsamd21"] = new Atsamd21();
var screen: St7735;
var buttons: Buttons;
var keymap: number[];
var atsamd21 = window["atsamd21"];
var running = false;

var exampleGames = [
    {
        name: "Solitaire",
        url: "https://raw.githubusercontent.com/Rodot/Games-META/master/binaries/Solitaire/Solitaire.bin"
    }
];

listGames();
resetButton();
listenToFileUpload();
customKeyMapping();

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
    }, 1000);

function listGames() {
    var example = document.getElementById('example');
    example.onclick = function() { loadGame (exampleGames[0].url); return false; };
    example.appendChild(document.createTextNode('Try an example game!'));
}

function resetButton() {
    var elem = document.getElementById('reset-container');
    var btn = document.createElement("button");
    btn.onclick = function() { screen.clear(); atsamd21.reset(0x4000); };
    btn.innerHTML = 'Reset';
    elem.appendChild(btn);
}

function customKeyMapping() {
    var custom = document.getElementById('custom-keys');
    custom.onclick = function() { doDown(); return false; };
    custom.appendChild(document.createTextNode('Or create your own key mapping.'));
}

function giveInstruction(message: string) {
    var span = document.getElementById('instruction');
    span.innerText = message;
}

function doDown() {
    keymap = [];
    giveInstruction("Press Down");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doLeft();
    };
    document.addEventListener('keydown', handler);
}

function doLeft() {
    giveInstruction("Press Left");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doRight();
    };
    document.addEventListener('keydown', handler);
}

function doRight() {
    giveInstruction("Press Right");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doUp();
    };
    document.addEventListener('keydown', handler);
}

function doUp() {
    giveInstruction("Press Up");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doA();
    };
    document.addEventListener('keydown', handler);
}

function doA() {
    giveInstruction("Press A");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doB();
    };
    document.addEventListener('keydown', handler);
}

function doB() {
    giveInstruction("Press B");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doMenu();
    };
    document.addEventListener('keydown', handler);
}

function doMenu() {
    giveInstruction("Press Menu");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        doHome();
    };
    document.addEventListener('keydown', handler);
}

function doHome() {
    giveInstruction("Press Home");
    var handler = (event) => {
        keymap.push(event.keyCode);
        document.removeEventListener('keydown', handler);
        if (buttons) buttons.setKeymap(keymap);
        giveInstruction("");
    };
    document.addEventListener('keydown', handler);
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
    // Clear the canvas
    screen.clear();

    buttons = new Buttons(atsamd21.sercom4, atsamd21.portA, atsamd21.portB);
    if (keymap) buttons.setKeymap(keymap);

    if (!running) {
        running = true;
        run();
    }
}