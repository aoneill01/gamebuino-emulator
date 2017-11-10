import { Atsamd21 } from './atsamd21';

console.log('hello');
var atsamd21 = new Atsamd21();
document.getElementById('light').innerHTML = atsamd21.pcIndex.toString(16);
